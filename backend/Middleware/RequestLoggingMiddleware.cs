using Serilog;

namespace SmartRecyclingBin.Middleware
{
    public class RequestLoggingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestLoggingMiddleware> _logger;

        public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var start = DateTime.UtcNow;
            
            try
            {
                await _next(context);
            }
            finally
            {
                var elapsed = DateTime.UtcNow - start;
                var statusCode = context.Response?.StatusCode;
                var method = context.Request?.Method;
                var path = context.Request?.Path.Value;

                if (statusCode >= 400)
                {
                    _logger.LogWarning("HTTP {Method} {Path} responded {StatusCode} in {Elapsed:0.0000} ms",
                        method, path, statusCode, elapsed.TotalMilliseconds);
                }
                else
                {
                    _logger.LogInformation("HTTP {Method} {Path} responded {StatusCode} in {Elapsed:0.0000} ms",
                        method, path, statusCode, elapsed.TotalMilliseconds);
                }
            }
        }
    }
}