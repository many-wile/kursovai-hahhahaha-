using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Survey.Data;
using Survey.Models;
using Survey.Models.DTO;
using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Survey.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    public sealed class RefreshRequest
    {
        public string RefreshToken { get; set; } = string.Empty;
    }

    private readonly AppDbContext _context;
    private readonly IConfiguration _cfg;
    private static readonly ConcurrentDictionary<string, int> RefreshTokens = new();
    private static readonly ConcurrentDictionary<string, string> AccessTokens = new();

    public AuthController(AppDbContext context, IConfiguration cfg)
    {
        _context = context;
        _cfg = cfg;
    }

    [HttpPost("register")]
    public async Task<ActionResult> Register(UserRegisterDto req)
    {
        if (await _context.Users.AnyAsync(u => u.Email == req.Email))
        {
            return BadRequest("Email занят");
        }

        var user = new User
        {
            FullName = req.FullName,
            Email = req.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = "User"
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(CreateAuthResponse(user));
    }

    [HttpPost("login")]
    public async Task<ActionResult> Login(UserLoginDto req)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == req.Email);

        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        {
            return BadRequest("Ошибка входа");
        }

        return Ok(CreateAuthResponse(user));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult> Refresh([FromBody] RefreshRequest? req)
    {
        var refreshToken = req?.RefreshToken?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(refreshToken) || !RefreshTokens.TryGetValue(refreshToken, out var userId))
        {
            return Unauthorized("Refresh token невалиден.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(item => item.Id == userId);
        if (user == null)
        {
            RefreshTokens.TryRemove(refreshToken, out _);
            return Unauthorized("Пользователь не найден.");
        }

        RefreshTokens.TryRemove(refreshToken, out _);
        return Ok(CreateAuthResponse(user));
    }

    [Authorize]
    [HttpPost("logout")]
    public ActionResult Logout([FromBody] RefreshRequest? req)
    {
        var accessToken = ExtractBearerToken();
        if (!string.IsNullOrWhiteSpace(accessToken) &&
            AccessTokens.TryRemove(accessToken, out var linkedRefreshToken))
        {
            RefreshTokens.TryRemove(linkedRefreshToken, out _);
        }

        var refreshToken = req?.RefreshToken?.Trim() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(refreshToken))
        {
            RefreshTokens.TryRemove(refreshToken, out _);
        }

        return Ok(new { success = true });
    }

    private string CreateToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, user.Email),
            new Claim("UserId", user.Id.ToString())
        };

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_cfg["Jwt:Key"] ?? "super_secret_key_1234567890_long_enough"));

        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            _cfg["Jwt:Issuer"],
            _cfg["Jwt:Audience"],
            claims,
            expires: DateTime.Now.AddDays(1),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private object CreateAuthResponse(User user)
    {
        var accessToken = CreateToken(user);
        var refreshToken = Guid.NewGuid().ToString("N");

        RefreshTokens[refreshToken] = user.Id;
        AccessTokens[accessToken] = refreshToken;

        return new
        {
            user,
            accessToken,
            refreshToken
        };
    }

    private string ExtractBearerToken()
    {
        var header = Request.Headers.Authorization.ToString();
        const string prefix = "Bearer ";

        if (!header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        return header[prefix.Length..].Trim();
    }
}
