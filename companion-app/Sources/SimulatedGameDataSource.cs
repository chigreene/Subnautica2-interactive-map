namespace SN2Companion.Sources;

public sealed class SimulatedGameDataSource(int pollIntervalMs) : IGameDataSource
{
    public async IAsyncEnumerable<GameState> ReadStatesAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var start = DateTimeOffset.UtcNow;

        while (!cancellationToken.IsCancellationRequested)
        {
            var t = (DateTimeOffset.UtcNow - start).TotalSeconds;
            var x = (double)(Math.Cos(t * 0.4) * 250.0);
            var z = (double)(Math.Sin(t * 0.4) * 160.0);
            var y = (double)(-45.0 + Math.Sin(t * 0.8) * 10.0);
            var yaw = (double)((t * 45.0) % 360.0);

            yield return new GameState(
                x,
                y,
                z,
                yaw,
                "simulator",
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                Array.Empty<GameEvent>()
            );

            await Task.Delay(pollIntervalMs, cancellationToken);
        }
    }
}
