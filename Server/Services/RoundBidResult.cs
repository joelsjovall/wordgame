using Server.Data.Entities;

namespace Server.Services;

public class RoundBidResult
{
    public required Round Round { get; init; }
    public required Bid Bid { get; init; }
}
