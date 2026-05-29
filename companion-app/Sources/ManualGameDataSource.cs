namespace SN2Companion.Sources;

public sealed class ManualGameDataSource : IGameDataSource
{
    public async IAsyncEnumerable<GameState> ReadStatesAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            yield return new GameState(
                0.0,
                0.0,
                0.0,
                0.0,
                "manual-waiting-for-post",
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                Array.Empty<GameEvent>()
            );

            await Task.Delay(1000, cancellationToken);
        }
    }
}
