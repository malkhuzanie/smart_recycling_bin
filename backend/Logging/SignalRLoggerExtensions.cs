namespace SmartRecyclingBin.Logging
{
    public static class SignalRLoggerExtensions
    {
        public static ILoggingBuilder AddSignalRLogger(this ILoggingBuilder builder)
        {
            builder.Services.AddSingleton<ILoggerProvider, SignalRLoggerProvider>();
            return builder;
        }
    }
}