using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace PasswordVault
{
    public static class EncryptionHelper
    {
        public static string Encrypt(string text)
        {
            try
            {
                return Convert.ToBase64String(Encoding.UTF8.GetBytes(text));
            }
            catch
            {
                return text;
            }
        }

        public static string Decrypt(string text)
        {
            try
            {
                return Encoding.UTF8.GetString(Convert.FromBase64String(text));
            }
            catch
            {
                return text;
            }
        }
    }

    public static class PasswordGenerator
    {
        public static string Generate(int length, bool useLetters, bool useDigits, bool useSymbols)
        {
            string letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
            string digits = "0123456789";
            string symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
            
            string pool = "";
            if (useLetters) pool += letters;
            if (useDigits) pool += digits;
            if (useSymbols) pool += symbols;

            if (string.IsNullOrEmpty(pool))
                pool = letters;

            Random rand = new Random();
            StringBuilder res = new StringBuilder();
            for (int i = 0; i < length; i++)
            {
                res.Append(pool[rand.Next(pool.Length)]);
            }
            return res.ToString();
        }
    }

    public static class VaultStorage
    {
        private static readonly string FilePath = Path.Combine(Application.StartupPath, "vault.dat");

        public static void Save(List<PasswordEntry> entries)
        {
            try
            {
                using (StreamWriter sw = new StreamWriter(FilePath, false, Encoding.UTF8))
                {
                    foreach (var entry in entries)
                    {
                        sw.WriteLine($"{entry.ServiceName}|{entry.Login}|{entry.Password}|{entry.DateAdded}");
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Ошибка при сохранении: " + ex.Message);
            }
        }

        public static List<PasswordEntry> Load()
        {
            List<PasswordEntry> entries = new List<PasswordEntry>();
            try
            {
                if (!File.Exists(FilePath)) return entries;

                string[] lines = File.ReadAllLines(FilePath, Encoding.UTF8);
                foreach (string line in lines)
                {
                    string[] parts = line.Split('|');
                    if (parts.Length >= 4)
                    {
                        var entry = new PasswordEntry(parts[0], parts[1], parts[2]);
                        if (DateTime.TryParse(parts[3], out DateTime dt))
                        {
                            entry.DateAdded = dt;
                        }
                        entries.Add(entry);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Ошибка при загруз/ке: " + ex.Message);
            }
            return entries;
        }
    }
}
