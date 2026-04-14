using Server.Data.Entities;

namespace Server.Services;

public interface IRoundService
{
    RoundBidResult PlaceBid(Round round, int playerId, int bidCount);
}
