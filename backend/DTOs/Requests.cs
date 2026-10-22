using System.ComponentModel.DataAnnotations;
namespace LogiTrack.DTOs;
public record RegisterRequest([Required, EmailAddress, StringLength(254)] string Email, [Required, StringLength(1024)] string Password);
public record LoginRequest([Required, EmailAddress, StringLength(254)] string Email, [Required, StringLength(1024)] string Password);
public record InventoryRequest([Required, StringLength(120)] string Name, [Range(0, int.MaxValue)] int Quantity, [Required, StringLength(120)] string Location);
public record OrderLineRequest([Range(1, int.MaxValue)] int InventoryItemId, [Range(1, int.MaxValue)] int Quantity);
public record CreateOrderRequest([Required, StringLength(120)] string CustomerName, [Required, MinLength(1)] List<OrderLineRequest> Items);
