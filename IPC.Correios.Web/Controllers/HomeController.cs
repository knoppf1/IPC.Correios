using System.Web.Mvc;
using System.Collections.Generic;
using IPC.Correios.Web.Models;
using System.Linq;


namespace IPC.Correios.Middleware.Web.Controllers
{
    public class HomeController : Controller
    {
        
        public ActionResult Index()
        {
            return View();
        }

        public ActionResult About()
        {
            ViewBag.Message = "Your application description page.";

            return View();
        }

        public ActionResult Contact()
        {
            ViewBag.Message = "Your contact page.";

            return View();
        }

        public ActionResult BuscaCep()
        {
            

            string filePath1 = @"C:\Users\kerst\Desktop\projeto-provapratica\IPC.Correios.Web\App_Data\Correios\LOG_LOGRADOURO_SC2.TXT";
            string filePath2 = @"C:\Users\kerst\Desktop\projeto-provapratica\IPC.Correios.Web\App_Data\Correios\LOG_LOCALIDADE.TXT";

            List<string> lines1 = System.IO.File.ReadAllLines(filePath1).ToList();
            List<string> lines2 = System.IO.File.ReadAllLines(filePath2).ToList();

            List<Logradouro> cadastro = new List<Logradouro>();
            //List<Logradouro> unique = new List<Logradouro>();



            foreach (var line1 in lines1)
            {
                string[] entries = line1.Split('@');
                Logradouro newLogradouro = new Logradouro();
                newLogradouro.Estado = entries[1];
                newLogradouro.CodMun = entries[2];
                
                if(newLogradouro.Estado == "SC")

                    foreach (var line2 in lines2)
                    {
                        string[] entries2 = line2.Split('@');
                        Logradouro localidade = new Logradouro();
                        localidade.CodMun = entries2[0];
                        localidade.Municipio = entries2[2];

                        if (localidade.CodMun == newLogradouro.CodMun)
                        {
                            newLogradouro.Municipio = localidade.Municipio;
                                
                                    cadastro.Add(newLogradouro);
                        }
                    }
            }


            //var unique = cadastro.Distinct(Logradouro => Logradouro.Municipio).ToList();


            ViewBag.Message = "";

            return View(cadastro);
        }

        public ActionResult BuscaEndereco()
        {
            ViewBag.Message = "";

            return View();
        }

        


        [HttpPost]
        public ActionResult Index(int? id)
        {
            return RedirectToAction("VerificaLogradouro", new { cep = id });
        }


        public ActionResult VerificaLogradouro( string cep)

        {
            
            string filePath1 = @"C:\Users\kerst\Desktop\projeto-provapratica\IPC.Correios.Web\App_Data\Correios\LOG_LOGRADOURO_SC.TXT";
            string filePath2 = @"C:\Users\kerst\Desktop\projeto-provapratica\IPC.Correios.Web\App_Data\Correios\LOG_LOCALIDADE.TXT";

            List<string> lines1 = System.IO.File.ReadAllLines(filePath1).ToList();
            List<string> lines2 = System.IO.File.ReadAllLines(filePath2).ToList();

            List<Logradouro> cadastro = new List<Logradouro>();

            foreach (var line1 in lines1)
            {
                string[] entries = line1.Split('@');
                Logradouro newLogradouro = new Logradouro();
                newLogradouro.Estado = entries[1];
                newLogradouro.CodMun = entries[2];
                newLogradouro.Cep = entries[7];
                newLogradouro.Endereco = entries[10];

                if(newLogradouro.Cep == cep)
                {
                    foreach (var line2 in lines2)
                    {
                        string[] entries2 = line2.Split('@');
                        Logradouro localidade = new Logradouro();
                        localidade.CodMun = entries2[0];
                        localidade.Municipio = entries2[2];

                        if(localidade.CodMun == newLogradouro.CodMun)
                        {
                            newLogradouro.Municipio = localidade.Municipio;
                        }
                    }
                    cadastro.Add(newLogradouro);
                }
            }

            if(cadastro.Count==0)
            {
                ViewBag.Message = "Endereço Não Localizado! Verifique o CEP!";
            }
            else
            {
                ViewBag.Message = "Endereço Localizado!";
            }
            
            return View(cadastro);
            
        }
    }

}