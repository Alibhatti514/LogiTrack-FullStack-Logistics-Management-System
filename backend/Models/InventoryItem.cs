using System.ComponentModel.DataAnnotations;
namespace LogiTrack.Models;
public class InventoryItem
{
    [Key] public int ItemId { get; set; }
    [Required, StringLength(120)] public string Name { get; set; } = "";
    [Range(0, int.MaxValue)] public int Quantity { get; set; }
    [Required, StringLength(120)] public string Location { get; set; } = "";
    public List<OrderItem> OrderItems { get; set; } = new();
    public void DisplayInfo() => Console.WriteLine($"Item: {Name} | Quantity: {Quantity} | Location: {Location}");
}
