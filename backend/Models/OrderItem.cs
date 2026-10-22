using System.ComponentModel.DataAnnotations;
namespace LogiTrack.Models;
public class OrderItem
{
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public int InventoryItemId { get; set; }
    public InventoryItem InventoryItem { get; set; } = null!;
    [Range(1, int.MaxValue)] public int Quantity { get; set; }
}
