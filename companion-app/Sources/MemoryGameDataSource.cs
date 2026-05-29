using SN2Companion.Memory;

namespace SN2Companion.Sources;

public sealed class MemoryGameDataSource(MemoryOptions options, int pollIntervalMs) : IGameDataSource
{
    public async IAsyncEnumerable<GameState> ReadStatesAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            GameState state;

            try
            {
                using var reader = ProcessMemoryReader.TryOpen(options.ProcessName);
                if (reader is null)
                {
                    state = ErrorState($"process-not-found:{options.ProcessName}");
                }
                else
                {
                    var sample = ReadSample(reader, options);
                    state = new GameState(
                        sample.X,
                        sample.Y,
                        sample.Z,
                        sample.Yaw,
                        "memory",
                        DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        Array.Empty<GameEvent>()
                    );
                }
            }
            catch (Exception ex)
            {
                state = ErrorState($"memory-error:{ex.GetType().Name}:{ex.Message}");
            }

            yield return state;
            await Task.Delay(pollIntervalMs, cancellationToken);
        }
    }

    private static MemorySample ReadSample(ProcessMemoryReader reader, MemoryOptions options)
    {
        if (options.AddressMode.Equals("absolute", StringComparison.OrdinalIgnoreCase))
        {
            return new MemorySample(
                ReadDoubleOrDefault(reader, ParseHexOrDefault(options.AbsoluteXAddressHex)),
                ReadDoubleOrDefault(reader, ParseHexOrDefault(options.AbsoluteYAddressHex)),
                ReadDoubleOrDefault(reader, options.AbsoluteZAddressHex),
                ReadDoubleOrDefault(reader, options.AbsoluteYawAddressHex)
            );
        }

        var moduleBase = reader.GetModuleBaseAddress(options.ModuleName);
        var address = moduleBase + ParseHexOrDefault(options.BaseOffsetHex);

        foreach (var offsetText in options.PointerOffsetsHex)
        {
            address = reader.ReadPointer(address) + ParseHexOrDefault(offsetText);
        }

        return new MemorySample(
            ReadDoubleOrDefault(reader, address + ParseHexOrDefault(options.XOffsetHex)),
            ReadDoubleOrDefault(reader, address + ParseHexOrDefault(options.YOffsetHex)),
            ReadDoubleOrDefault(reader, address + ParseHexOrDefault(options.ZOffsetHex)),
            ReadDoubleOrDefault(reader, address + ParseHexOrDefault(options.YawOffsetHex))
        );
    }

    private static long ParseHexOrDefault(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return 0;
        }

        text = text.Trim();
        if (text.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
        {
            return Convert.ToInt64(text[2..], 16);
        }
        return Convert.ToInt64(text, 16);
    }

    private static double ReadDoubleOrDefault(ProcessMemoryReader reader, string? addressHex)
    {
        var address = ParseHexOrDefault(addressHex);
        return ReadDoubleOrDefault(reader, address);
    }

    private static double ReadDoubleOrDefault(ProcessMemoryReader reader, long address)
    {
        if (address == 0)
        {
            return 0.0;
        }

        try
        {
            return reader.ReadDouble(address);
        }
        catch
        {
            return 0.0;
        }
    }

    private static GameState ErrorState(string source) => new(
        0,
        0,
        0,
        0,
        source,
        DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        Array.Empty<GameEvent>()
    );

    private sealed record MemorySample(double X, double Y, double Z, double Yaw);
}
