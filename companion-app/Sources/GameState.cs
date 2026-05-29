namespace SN2Companion.Sources;

public sealed record GameState(
    double X,
    double Y,
    double Z,
    double Yaw,
    string Source,
    long UpdatedAtUnixMs,
    IReadOnlyList<GameEvent> Events
);

public sealed record GameEvent(
    string Type,
    string Name,
    long OccurredAtUnixMs,
    Dictionary<string, string>? Data = null
);

public interface IGameDataSource
{
    IAsyncEnumerable<GameState> ReadStatesAsync(CancellationToken cancellationToken);
}

public sealed class GameStateStore
{
    private readonly object _lock = new();
    private GameState _state = new(0, 0, 0, 0, "initial", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), Array.Empty<GameEvent>());

    public GameState Get()
    {
        lock (_lock) return _state;
    }

    public void Set(GameState state)
    {
        lock (_lock) _state = state;
    }
}
