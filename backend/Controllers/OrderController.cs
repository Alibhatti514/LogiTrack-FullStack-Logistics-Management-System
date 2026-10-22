using LogiTrack.Data;
using LogiTrack.DTOs;
using LogiTrack.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
namespace LogiTrack.Controllers;
[ApiController, Route("api/orders"), Authorize]
public class OrderController(LogiTrackContext db, IMemoryCache cache) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(await db.Orders.AsNoTracking()
        .OrderByDescending(o => o.DatePlaced)
        .Select(o => new { o.OrderId, o.CustomerName, o.DatePlaced, ItemCount = o.Items.Sum(i => i.Quantity) }).ToListAsync(ct));
    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics(CancellationToken ct) => Ok(await db.OrderItems.AsNoTracking()
        .GroupBy(line => new { line.InventoryItemId, line.InventoryItem.Name })
        .Select(group => new { group.Key.InventoryItemId, group.Key.Name,
            OrderedUnits = group.Sum(line => (long)line.Quantity), OrderCount = group.Count() })
        .OrderByDescending(item => item.OrderCount).ThenByDescending(item => item.OrderedUnits)
        .Take(8).ToListAsync(ct));
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().Where(o => o.OrderId == id)
            .Select(o => new { o.OrderId, o.CustomerName, o.DatePlaced,
                Items = o.Items.Select(i => new { i.InventoryItemId, i.InventoryItem.Name, i.Quantity }).ToList() })
            .SingleOrDefaultAsync(ct);
        return order is null ? NotFound() : Ok(order);
    }
    [HttpPost, Authorize(Roles = "Manager")]
    public async Task<IActionResult> Create(CreateOrderRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerName) || request.Items is null || request.Items.Count == 0)
            return BadRequest(new { error = "Customer name and at least one order line are required" });
        if (request.Items.Any(x => x.Quantity <= 0 || x.InventoryItemId <= 0)) return BadRequest(new { error = "Invalid order line" });
        var lines = request.Items.GroupBy(x => x.InventoryItemId)
            .Select(g => new { Id = g.Key, Quantity = g.Sum(x => (long)x.Quantity) }).ToList();
        if (lines.Any(x => x.Quantity > int.MaxValue)) return BadRequest(new { error = "Quantity too large" });
        // SQLite uses a write transaction to serialize inventory decrements for this demonstration.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Conditional SQL updates prevent a stale read from overdrawing stock.
        // Every line and the order insert share the same transaction; failures roll back all lines.
        foreach (var line in lines.OrderBy(x => x.Id))
        {
            var quantity = (int)line.Quantity;
            var changed = await db.InventoryItems.Where(x => x.ItemId == line.Id && x.Quantity >= quantity)
                .ExecuteUpdateAsync(set => set.SetProperty(x => x.Quantity, x => x.Quantity - quantity), ct);
            if (changed == 0)
            {
                if (!await db.InventoryItems.AnyAsync(x => x.ItemId == line.Id, ct))
                    return BadRequest(new { error = "One or more inventory items do not exist" });
                return Conflict(new { error = $"Insufficient stock for item {line.Id}" });
            }
        }
        var order = new Order { CustomerName = request.CustomerName.Trim(), DatePlaced = DateTime.UtcNow,
            Items = lines.Select(x => new OrderItem { InventoryItemId = x.Id, Quantity = (int)x.Quantity }).ToList() };
        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        cache.Remove(InventoryController.CacheKey);
        return Created($"/api/orders/{order.OrderId}", new { order.OrderId, order.CustomerName, order.DatePlaced });
    }
    [HttpDelete("{id:int}"), Authorize(Roles = "Manager")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var order = await db.Orders.Include(o => o.Items).SingleOrDefaultAsync(o => o.OrderId == id, ct);
        if (order is null) return NotFound();
        foreach (var line in order.Items)
        {
            var changed = await db.InventoryItems
                .Where(x => x.ItemId == line.InventoryItemId && x.Quantity <= int.MaxValue - line.Quantity)
                .ExecuteUpdateAsync(set => set.SetProperty(x => x.Quantity, x => x.Quantity + line.Quantity), ct);
            if (changed != 1) return Conflict(new { error = "Stock restoration would exceed the supported quantity. Order was not deleted." });
        }
        db.Orders.Remove(order);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        cache.Remove(InventoryController.CacheKey);
        return NoContent();
    }
}
