using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using SN2Companion.Memory;
using SN2Companion.Sources;

var builder = WebApplication.CreateBuilder(args);

var companionOptions = builder.Configuration.GetSection("Companion").Get<CompanionOptions>() ?? new CompanionOptions();
var memoryOptions = builder.Configuration.GetSection("Memory").Get<MemoryOptions>() ?? new MemoryOptions();

builder.WebHost.UseUrls(companionOptions.BindUrl);

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseWebSockets();

var store = new GameStateStore();
using var cts = new CancellationTokenSource();

IGameDataSource source = companionOptions.Mode.ToLowerInvariant() switch
{
    "memory" => new MemoryGameDataSource(memoryOptions, companionOptions.PollIntervalMs),
    "manual" => new ManualGameDataSource(),
    _ => new SimulatedGameDataSource(companionOptions.PollIntervalMs)
};

_ = Task.Run(async () =>
{
    await foreach (var state in source.ReadStatesAsync(cts.Token))
    {
        store.Set(state);
    }
});

app.Lifetime.ApplicationStopping.Register(() => cts.Cancel());

app.MapGet("/status", () =>
{
    var state = store.Get();
    return Results.Json(new
    {
        mode = companionOptions.Mode,
        source = state.Source,
        updatedAtUnixMs = state.UpdatedAtUnixMs,
        state.X,
        state.Y,
        state.Z,
        state.Yaw
    });
});

app.MapGet("/debug-memory", () =>
{
    try
    {
        using var reader = ProcessMemoryReader.TryOpen(memoryOptions.ProcessName);
        if (reader is null)
        {
            return Results.Json(new { error = $"process-not-found:{memoryOptions.ProcessName}" });
        }

        long ParseHexOrDefault(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return 0;
            text = text.Trim();
            if (text.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
            {
                return Convert.ToInt64(text[2..], 16);
            }
            return Convert.ToInt64(text, 16);
        }

        var moduleBase = reader.GetModuleBaseAddress(memoryOptions.ModuleName);
        var baseAddress = moduleBase + ParseHexOrDefault(memoryOptions.BaseOffsetHex);

        long ResolvePointerChain()
        {
            var addr = baseAddress;
            foreach (var offsetText in memoryOptions.PointerOffsetsHex)
            {
                addr = reader.ReadPointer(addr) + ParseHexOrDefault(offsetText);
            }
            return addr;
        }

        var resolved = ResolvePointerChain();

        long addrX = memoryOptions.AddressMode.Equals("absolute", StringComparison.OrdinalIgnoreCase)
            ? ParseHexOrDefault(memoryOptions.AbsoluteXAddressHex)
            : resolved + ParseHexOrDefault(memoryOptions.XOffsetHex);

        long addrY = memoryOptions.AddressMode.Equals("absolute", StringComparison.OrdinalIgnoreCase)
            ? ParseHexOrDefault(memoryOptions.AbsoluteYAddressHex)
            : resolved + ParseHexOrDefault(memoryOptions.YOffsetHex);

        long addrZ = memoryOptions.AddressMode.Equals("absolute", StringComparison.OrdinalIgnoreCase)
            ? ParseHexOrDefault(memoryOptions.AbsoluteZAddressHex)
            : resolved + ParseHexOrDefault(memoryOptions.ZOffsetHex);

        long addrYaw = memoryOptions.AddressMode.Equals("absolute", StringComparison.OrdinalIgnoreCase)
            ? ParseHexOrDefault(memoryOptions.AbsoluteYawAddressHex)
            : resolved + ParseHexOrDefault(memoryOptions.YawOffsetHex);

        byte[] bx = addrX == 0 ? Array.Empty<byte>() : reader.ReadBytes(addrX, 4);
        byte[] by = addrY == 0 ? Array.Empty<byte>() : reader.ReadBytes(addrY, 4);
        byte[] bz = addrZ == 0 ? Array.Empty<byte>() : reader.ReadBytes(addrZ, 4);
        byte[] byaw = addrYaw == 0 ? Array.Empty<byte>() : reader.ReadBytes(addrYaw, 4);

        // also try reading 8 bytes for double interpretations
        byte[] bx8 = addrX == 0 ? Array.Empty<byte>() : (addrX > 0 ? reader.ReadBytes(addrX, 8) : Array.Empty<byte>());
        byte[] by8 = addrY == 0 ? Array.Empty<byte>() : (addrY > 0 ? reader.ReadBytes(addrY, 8) : Array.Empty<byte>());
        byte[] bz8 = addrZ == 0 ? Array.Empty<byte>() : (addrZ > 0 ? reader.ReadBytes(addrZ, 8) : Array.Empty<byte>());
        byte[] byaw8 = addrYaw == 0 ? Array.Empty<byte>() : (addrYaw > 0 ? reader.ReadBytes(addrYaw, 8) : Array.Empty<byte>());

        float fx = bx.Length == 4 ? BitConverter.ToSingle(bx, 0) : 0f;
        float fy = by.Length == 4 ? BitConverter.ToSingle(by, 0) : 0f;
        float fz = bz.Length == 4 ? BitConverter.ToSingle(bz, 0) : 0f;
        float fyaw = byaw.Length == 4 ? BitConverter.ToSingle(byaw, 0) : 0f;

        double dx = bx8.Length == 8 ? BitConverter.ToDouble(bx8, 0) : 0.0;
        double dy = by8.Length == 8 ? BitConverter.ToDouble(by8, 0) : 0.0;
        double dz = bz8.Length == 8 ? BitConverter.ToDouble(bz8, 0) : 0.0;
        double dyaw = byaw8.Length == 8 ? BitConverter.ToDouble(byaw8, 0) : 0.0;

        string Hex(byte[] b) => b.Length == 0 ? string.Empty : BitConverter.ToString(b).Replace("-", "");

        return Results.Json(new
        {
            moduleBase = moduleBase,
            baseAddress = baseAddress,
            resolved = resolved,
            x = new { address = addrX, raw = Hex(bx), value = fx, raw8 = Hex(bx8), value8 = dx },
            y = new { address = addrY, raw = Hex(by), value = fy, raw8 = Hex(by8), value8 = dy },
            z = new { address = addrZ, raw = Hex(bz), value = fz, raw8 = Hex(bz8), value8 = dz },
            yaw = new { address = addrYaw, raw = Hex(byaw), value = fyaw, raw8 = Hex(byaw8), value8 = dyaw }
        });
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = ex.GetType().Name, message = ex.Message });
    }
});

app.MapPost("/position", async (ManualPositionUpdate update) =>
{
    var state = new GameState(
        update.X,
        update.Y,
        update.Z,
        update.Yaw,
        "manual-post",
        DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        Array.Empty<GameEvent>()
    );
    store.Set(state);
    return Results.Json(state);
});

app.Map("/ws", async context =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    using var socket = await context.WebSockets.AcceptWebSocketAsync();
    while (socket.State == WebSocketState.Open && !context.RequestAborted.IsCancellationRequested)
    {
        var state = store.Get();
        var json = JsonSerializer.Serialize(state, JsonOptions.Default);
        var bytes = Encoding.UTF8.GetBytes(json);
        await socket.SendAsync(bytes, WebSocketMessageType.Text, true, context.RequestAborted);
        await Task.Delay(companionOptions.PollIntervalMs, context.RequestAborted);
    }
});

Console.WriteLine($"SN2 Companion running at {companionOptions.BindUrl}");
Console.WriteLine($"Mode: {companionOptions.Mode}");
Console.WriteLine("Open the map in your browser, then leave this window running.");

await app.RunAsync();

public sealed class CompanionOptions
{
    public string Mode { get; set; } = "simulator";
    public int PollIntervalMs { get; set; } = 100;
    public string BindUrl { get; set; } = "http://127.0.0.1:8787";
}

public sealed record ManualPositionUpdate(double X, double Y, double Z, double Yaw);

public static class JsonOptions
{
    public static readonly JsonSerializerOptions Default = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false
    };
}
