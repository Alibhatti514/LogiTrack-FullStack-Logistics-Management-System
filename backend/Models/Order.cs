using System.ComponentModel.DataAnnotations;
namespace LogiTrack.Models;
public class Order
{
    [Key] public int OrderId { get; set; }
    [Required, StringLength(120)] public string CustomerName { get; set; } = "";
    public DateTime DatePlaced { get; set; } = DateTime.UtcNow;
    public List<OrderItem> Items { get; set; } = new();
    public void AddItem(InventoryItem item, int quantity = 1)
    {
        if (quantity <= 0) throw new ArgumentOutOfRangeException(nameof(quantity));
        var existing = Items.FirstOrDefault(x => x.InventoryItemId == item.ItemId);
        if (existing is null) Items.Add(new OrderItem { InventoryItemId = item.ItemId, InventoryItem = item, Quantity = quantity });
        else existing.Quantity = checked(existing.Quantity + quantity);
    }
    public void RemoveItem(int itemId) => Items.RemoveAll(x => x.InventoryItemId == itemId);
    public string GetOrderSummary() => $"Order #{OrderId} for {CustomerName} | Items: {Items.Sum(x => x.Quantity)} | Placed: {DatePlaced:d}";
}
