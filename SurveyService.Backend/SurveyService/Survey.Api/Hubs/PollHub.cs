using Microsoft.AspNetCore.SignalR;

namespace Survey.Api.Hubs;

public class PollHub : Hub
{
    public async Task SendStatsUpdate(int surveyId)
    {
        await Clients.All.SendAsync("ReceiveStatsUpdate", surveyId);
    }
}