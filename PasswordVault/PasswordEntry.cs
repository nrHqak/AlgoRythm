using System;

namespace PasswordVault
{
    public class PasswordEntry
    {
        public string ServiceName { get; set; }
        public string Login { get; set; }
        public string Password { get; set; } // stored encrypted
        public DateTime DateAdded { get; set; }

        public PasswordEntry(string service, string login, string password)
        {
            ServiceName = service;
            Login = login;
            Password = password;
            DateAdded = DateTime.Now;
        }
    }
}
