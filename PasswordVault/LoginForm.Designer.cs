using System.Drawing;
using System.Windows.Forms;

namespace PasswordVault
{
    partial class LoginForm
    {
        private System.ComponentModel.IContainer components = null;
        private Panel pnlMain;
        private Label lblTitle;
        private Label lblMasterPassword;
        private TextBox txtMasterPassword;
        private Button btnLogin;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        private void InitializeComponent()
        {
            this.pnlMain = new Panel();
            this.lblTitle = new Label();
            this.lblMasterPassword = new Label();
            this.txtMasterPassword = new TextBox();
            this.btnLogin = new Button();

            this.SuspendLayout();

            // Form
            this.ClientSize = new Size(400, 300);
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(245, 247, 250);
            this.Text = "Вход в систему";

            // pnlMain
            this.pnlMain.Size = new Size(320, 220);
            this.pnlMain.Location = new Point(40, 40);
            this.pnlMain.BackColor = Color.White;
            this.pnlMain.BorderStyle = BorderStyle.FixedSingle;

            // lblTitle
            this.lblTitle.Text = "Вход в систему";
            this.lblTitle.Font = new Font("Segoe UI", 16F, FontStyle.Bold);
            this.lblTitle.ForeColor = Color.FromArgb(27, 58, 107);
            this.lblTitle.TextAlign = ContentAlignment.MiddleCenter;
            this.lblTitle.Size = new Size(300, 40);
            this.lblTitle.Location = new Point(10, 20);

            // lblMasterPassword
            this.lblMasterPassword.Text = "Мастер-пароль:";
            this.lblMasterPassword.Font = new Font("Segoe UI", 10F);
            this.lblMasterPassword.Size = new Size(300, 20);
            this.lblMasterPassword.Location = new Point(10, 80);

            // txtMasterPassword
            this.txtMasterPassword.PasswordChar = '•';
            this.txtMasterPassword.Size = new Size(300, 30);
            this.txtMasterPassword.Location = new Point(10, 110);
            this.txtMasterPassword.Font = new Font("Segoe UI", 12F);
            this.txtMasterPassword.KeyDown += new KeyEventHandler(txtMasterPassword_KeyDown);

            // btnLogin
            this.btnLogin.Text = "ВОЙТИ";
            this.btnLogin.BackColor = Color.FromArgb(27, 58, 107);
            this.btnLogin.ForeColor = Color.White;
            this.btnLogin.FlatStyle = FlatStyle.Flat;
            this.btnLogin.Size = new Size(300, 40);
            this.btnLogin.Location = new Point(10, 160);
            this.btnLogin.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
            this.btnLogin.Click += new System.EventHandler(this.btnLogin_Click);

            this.pnlMain.Controls.Add(lblTitle);
            this.pnlMain.Controls.Add(lblMasterPassword);
            this.pnlMain.Controls.Add(txtMasterPassword);
            this.pnlMain.Controls.Add(btnLogin);
            this.Controls.Add(pnlMain);

            this.ResumeLayout(false);
        }
    }
}
