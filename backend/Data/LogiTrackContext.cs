using LogiTrack.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
namespace LogiTrack.Data;
public class LogiTrackContext(DbContextOptions<LogiTrackContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<OrderItem>().HasKey(x => new { x.OrderId, x.InventoryItemId });
        builder.Entity<OrderItem>().HasOne(x => x.Order).WithMany(x => x.Items).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.Entity<OrderItem>().HasOne(x => x.InventoryItem).WithMany(x => x.OrderItems).HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<InventoryItem>().HasIndex(x => x.Name);
        builder.Entity<Order>().HasIndex(x => x.DatePlaced);
    }
}
