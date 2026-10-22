using LogiTrack.Data;
using LogiTrack.DTOs;
using LogiTrack.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
namespace LogiTrack.Controllers;
[ApiController, Route("api/inventory"), Authorize]
public class InventoryController(LogiTrackContext db, IMemoryCache cache) : ControllerBase
{
    public const string CacheKey = "inventory:list:v1";
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        // Read current stock directly: a cached read can race mutation invalidation.
        var result = await db.InventoryItems.AsNoTracking().OrderBy(x => x.ItemId)
            .Select(x => new InventoryResponse(x.ItemId, x.Name, x.Quantity, x.Location))
            .ToListAsync(ct);
        return Ok(result);
    }
    [HttpPost, Authorize(Roles = "Manager")]
    public async Task<IActionResult> Create(InventoryRequest request, CancellationToken ct)
    {
        var item = new InventoryItem { Name = request.Name.Trim(), Quantity = request.Quantity, Location = request.Location.Trim() };
        if (item.Name.Length == 0 || item.Location.Length == 0) return BadRequest(new { error = "Name and location cannot be blank" });
        db.InventoryItems.Add(item);
        await db.SaveChangesAsync(ct);
        cache.Remove(CacheKey);
        return Created($"/api/inventory/{item.ItemId}", new { item.ItemId, item.Name, item.Quantity, item.Location });
    }
    [HttpDelete("{id:int}"), Authorize(Roles = "Manager")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var item = await db.InventoryItems.FindAsync([id], ct);
        if (item is null) return NotFound();
        if (await db.OrderItems.AnyAsync(x => x.InventoryItemId == id, ct)) return Conflict(new { error = "Item is referenced by an order" });
        db.InventoryItems.Remove(item);
        await db.SaveChangesAsync(ct);
        cache.Remove(CacheKey);
        return NoContent();
    }
}
