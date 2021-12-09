using System.Web;
using System.Web.Mvc;

namespace IPC.Correios.Middleware.Web
{
    public class FilterConfig
    {
        public static void RegisterGlobalFilters(GlobalFilterCollection filters)
        {
            filters.Add(new HandleErrorAttribute());
        }
    }
}
