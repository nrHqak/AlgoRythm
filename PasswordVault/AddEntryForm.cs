using System;
using System.Windows.Forms;

namespace PasswordVault
{
    public partial class AddEntryForm : Form
    {
        public PasswordEntry ResultEntry { get; private set; }

        public AddEntryForm(PasswordEntry existing = null)
        {
            InitializeComponent();
            if (existing != null)
            {
                txtService.Text = existing.ServiceName;
                txtLogin.Text = existing.Login;
                txtPassword.Text = EncryptionHelper.Decrypt(existing.Password);
            }
        }

        private void btnTogglePassword_Click(object sender, EventArgs e)
        {
            if (txtPassword.PasswordChar == '•')
                txtPassword.PasswordChar = '\0';
            else
                txtPassword.PasswordChar = '•';
        }

        private void btnGenerate_Click(object sender, EventArgs e)
        {
            int length = (int)numLength.Value;
            txtPassword.Text = PasswordGenerator.Generate(length, chkLetters.Checked, chkDigits.Checked, chkSymbols.Checked);
        }

        private void btnSave_Click(object sender, EventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtService.Text) || 
                string.IsNullOrWhiteSpace(txtLogin.Text) || 
                string.IsNullOrWhiteSpace(txtPassword.Text))
            {
                MessageBox.Show("Заполните все поля!", "Ошибка");
                return;
            }

            ResultEntry = new PasswordEntry(txtService.Text, txtLogin.Text, EncryptionHelper.Encrypt(txtPassword.Text));
            this.DialogResult = DialogResult.OK;
            this.Close();
        }

        private void btnCancel_Click(object sender, EventArgs e)
        {
            this.DialogResult = DialogResult.Cancel;
            this.Close();
        }
    }
}
