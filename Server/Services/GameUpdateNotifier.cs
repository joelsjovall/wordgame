using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Server.Services;

public sealed class GameUpdateNotifier
{
    private readonly ConcurrentDictionary<int, ConcurrentDictionary<Guid, Channel<string>>> subscribers = new();

    public (Guid SubscriptionId, ChannelReader<string> Reader) Subscribe(int gameId)
    {
        var channel = Channel.CreateUnbounded<string>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });
        var subscriptionId = Guid.NewGuid();
        var gameSubscribers = subscribers.GetOrAdd(gameId, _ => new ConcurrentDictionary<Guid, Channel<string>>());

        gameSubscribers[subscriptionId] = channel;

        return (subscriptionId, channel.Reader);
    }

    public void Unsubscribe(int gameId, Guid subscriptionId)
    {
        if (!subscribers.TryGetValue(gameId, out var gameSubscribers))
        {
            return;
        }

        if (gameSubscribers.TryRemove(subscriptionId, out var channel))
        {
            channel.Writer.TryComplete();
        }

        if (gameSubscribers.IsEmpty)
        {
            subscribers.TryRemove(gameId, out _);
        }
    }

    public void NotifyGameUpdated(int gameId)
    {
        if (!subscribers.TryGetValue(gameId, out var gameSubscribers))
        {
            return;
        }

        var payload = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();

        foreach (var subscriber in gameSubscribers)
        {
            if (!subscriber.Value.Writer.TryWrite(payload))
            {
                Unsubscribe(gameId, subscriber.Key);
            }
        }
    }
}
