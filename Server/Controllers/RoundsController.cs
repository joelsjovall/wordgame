using Microsoft.AspNetCore.Mvc;
using Server.Gameplay.DTOs;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/rounds")]
public class RoundsController(
    IRoundService roundService,
    GameFlowService gameFlowService,
    GameUpdateNotifier gameUpdateNotifier) : ControllerBase
{
    [HttpPost("{roundId:int}/bid")]
    public async Task<IActionResult> PlaceBid(int roundId, [FromBody] PlaceBidRequest request, CancellationToken cancellationToken)
    {
        await gameFlowService.ProcessRoundTimeoutsAsync(roundId, cancellationToken);

        if (request.PlayerId <= 0)
        {
            return BadRequest(new { message = "PlayerId must be greater than zero." });
        }

        if (request.BidCount <= 0)
        {
            return BadRequest(new { message = "BidCount must be greater than zero." });
        }

        try
        {
            var result = await roundService.PlaceBidAsync(roundId, request.PlayerId, request.BidCount, cancellationToken);
            gameUpdateNotifier.NotifyGameUpdated(result.Round.GameId);

            return Ok(new
            {
                roundId = result.Round.Id,
                highestBidCount = result.Round.HighestBidCount,
                highestBidPlayerId = result.Round.HighestBidPlayerId,
                latestBid = new
                {
                    result.Bid.PlayerId,
                    result.Bid.BidCount,
                    result.Bid.CreatedAt
                },
                totalBids = result.Round.Bids.Count
            });
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
        catch (ArgumentOutOfRangeException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }
}
