using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Survey.Data;
using Survey.Models;
using Survey.Models.DTO;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Survey.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _cfg;

    public AuthController(AppDbContext context, IConfiguration cfg)
    {
        _context = context;
        _cfg = cfg;
    }

    [HttpPost("register")]
    public async Task<ActionResult> Register(UserRegisterDto req)
    {
        if (await _context.Users.AnyAsync(u => u.Email == req.Email)) return BadRequest("Email занят");
        var user = new User { FullName = req.FullName, Email = req.Email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password), Role = "User" };
        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        return Ok(new { user, accessToken = CreateToken(user) });
    }

    [HttpPost("login")]
    public async Task<ActionResult> Login(UserLoginDto req)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash)) return BadRequest("Ошибка входа");
        return Ok(new { user, accessToken = CreateToken(user) });
    }

    private string CreateToken(User user)
    {
        var claims = new[] { new Claim(ClaimTypes.Name, user.Email), new Claim("UserId", user.Id.ToString()) };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_cfg["Jwt:Key"] ?? "super_secret_key_1234567890_long_enough"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(_cfg["Jwt:Issuer"], _cfg["Jwt:Audience"], claims, expires: DateTime.Now.AddDays(1), signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}