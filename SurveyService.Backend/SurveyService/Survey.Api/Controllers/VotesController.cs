using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Survey.Api.Hubs;

namespace Survey.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class VotesController : ControllerBase
{
    private readonly IHubContext<PollHub> _hubContext;

    public VotesController(IHubContext<PollHub> hubContext)
    {
        _hubContext = hubContext;
    }

    [HttpPost("{surveyId}")]
    public async Task<IActionResult> SubmitVote(int surveyId, [FromBody] object votePayload)
    {
        await _hubContext.Clients.All.SendAsync("ReceiveStatsUpdate", surveyId);
        return Ok(new { message = "Голос принят." });
    }
}