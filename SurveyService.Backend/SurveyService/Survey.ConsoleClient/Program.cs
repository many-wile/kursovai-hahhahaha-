using System.Net.Http.Json;
using Newtonsoft.Json;

Console.WriteLine("=== Survey Service Console Client ===");
using var client = new HttpClient();

try
{
    var response = await client.GetAsync("https://localhost:7054/api/Surveys?pageSize=5");

    if (response.IsSuccessStatusCode)
    {
        var jsonString = await response.Content.ReadAsStringAsync();
        dynamic data = JsonConvert.DeserializeObject(jsonString);

        Console.WriteLine("\nСписок последних опросов (из API):");
        foreach (var item in data.items)
        {
            Console.WriteLine($"ID: {item.id} | Название: {item.title}");
        }
    }
    else
    {
        Console.WriteLine("Сервер ответил ошибкой: " + response.StatusCode);
    }
}
catch (Exception ex)
{
    Console.WriteLine("Ошибка: убедитесь, что сервер запущен!");
    Console.WriteLine(ex.Message);
}

Console.WriteLine("\nНажмите любую клавишу для выхода...");
Console.ReadKey();