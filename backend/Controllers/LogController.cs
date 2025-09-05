using Microsoft.AspNetCore.Mvc;
using SmartRecyclingBin.Services;

namespace SmartRecyclingBin.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LogsController : ControllerBase
    {
        private readonly ILogService _logService;

        public LogsController(ILogService logService)
        {
            _logService = logService;
        }

        [HttpGet("{logFileName}")]
        public async Task<IActionResult> GetLog(string logFileName, [FromQuery] int lines = 500)
        {
            try
            {
                var logLines = await _logService.GetLogLinesAsync(logFileName, lines);
                return Ok(logLines);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch
            {
                return StatusCode(500, "An error occurred while fetching the logs.");
            }
        }
    }
}