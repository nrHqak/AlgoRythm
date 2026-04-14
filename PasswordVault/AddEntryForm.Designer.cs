using System.Drawing;
using System.Windows.Forms;

namespace PasswordVault
{
    partial class AddEntryForm
    {
        private System.ComponentModel.IContainer components = null;
        private Label lblTitle;
        private Label lblService;
        private TextBox txtService;
        private Label lblLogin;
        private TextBox txtLogin;
        private Label lblPassword;
        private TextBox txtPassword;
        private Button btnTogglePassword;
        private GroupBox gbGenerator;
        private Label lblLength;
        private NumericUpDown numLength;
        private CheckBox chkLetters;
        private CheckBox chkDigits;
        private CheckBox chkSymbols;
        private Button btnGenerate;
        private Button btnSave;
        private Button btnCancel;

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
            this.lblTitle = new Label();
            this.lblService = new Label();
            this.txtService = new TextBox();
            this.lblLogin = new Label();
            this.txtLogin = new TextBox();
            this.lblPassword = new Label();
            this.txtPassword = new TextBox();
            this.btnTogglePassword = new Button();
            this.gbGenerator = new GroupBox();
            this.lblLength = new Label();
            this.numLength = new NumericUpDown();
            this.chkLetters = new CheckBox();
            this.chkDigits = new CheckBox();
            this.chkSymbols = new CheckBox();
            this.btnGenerate = new Button();
            this.btnSave = new Button();
            this.btnCancel = new Button();

            this.SuspendLayout();

            // Form
            this.ClientSize = new Size(480, 400);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterParent;
            this.Text = "Добавить / Редактировать запись";

            // lblTitle
            this.lblTitle.Text = "Добавить / Редактировать запись";
            this.lblTitle.Font = new Font("Segoe UI", 14F, FontStyle.Bold);
            this.lblTitle.Location = new Point(20, 10);
            this.lblTitle.Size = new Size(440, 30);

            // lblService
            this.lblService.Text = "Название сервиса:";
            this.lblService.Location = new Point(20, 50);
            this.lblService.Size = new Size(150, 20);

            // txtService
            this.txtService.Location = new Point(20, 70);
            this.txtService.Size = new Size(440, 25);

            // lblLogin
            this.lblLogin.Text = "Логин:";
            this.lblLogin.Location = new Point(20, 105);
            this.lblLogin.Size = new Size(150, 20);

            // txtLogin
            this.txtLogin.Location = new Point(20, 125);
            this.txtLogin.Size = new Size(440, 25);

            // lblPassword
            this.lblPassword.Text = "Пароль:";
            this.lblPassword.Location = new Point(20, 160);
            this.lblPassword.Size = new Size(150, 20);

            // txtPassword
            this.txtPassword.Location = new Point(20, 180);
            this.txtPassword.Size = new Size(400, 25);
            this.txtPassword.PasswordChar = '•';

            // btnTogglePassword
            this.btnTogglePassword.Text = "👁";
            this.btnTogglePassword.Location = new Point(425, 179);
            this.btnTogglePassword.Size = new Size(35, 27);
            this.btnTogglePassword.Click += new System.EventHandler(this.btnTogglePassword_Click);

            // gbGenerator
            this.gbGenerator.Text = "Генератор паролей";
            this.gbGenerator.Location = new Point(20, 220);
            this.gbGenerator.Size = new Size(440, 100);

            this.lblLength.Text = "Длина:";
            this.lblLength.Location = new Point(10, 25);
            this.lblLength.Size = new Size(50, 20);
            this.numLength.Location = new Point(60, 23);
            this.numLength.Size = new Size(50, 25);
            this.numLength.Minimum = 6;
            this.numLength.Maximum = 32;
            this.numLength.Value = 12;

            this.chkLetters.Text = "Буквы (A-Z)";
            this.chkLetters.Location = new Point(120, 23);
            this.chkLetters.Checked = true;
            this.chkLetters.Size = new Size(100, 25);

            this.chkDigits.Text = "Цифры (0-9)";
            this.chkDigits.Location = new Point(230, 23);
            this.chkDigits.Checked = true;
            this.chkDigits.Size = new Size(100, 25);

            this.chkSymbols.Text = "Спецсимволы (!@#)";
            this.chkSymbols.Location = new Point(120, 55);
            this.chkSymbols.Size = new Size(150, 25);

            this.btnGenerate.Text = "СГЕНЕРИРОВАТЬ";
            this.btnGenerate.BackColor = Color.FromArgb(46, 95, 163);
            this.btnGenerate.ForeColor = Color.White;
            this.btnGenerate.FlatStyle = FlatStyle.Flat;
            this.btnGenerate.Location = new Point(280, 55);
            this.btnGenerate.Size = new Size(150, 30);
            this.btnGenerate.Click += new System.EventHandler(this.btnGenerate_Click);

            this.gbGenerator.Controls.Add(lblLength);
            this.gbGenerator.Controls.Add(numLength);
            this.gbGenerator.Controls.Add(chkLetters);
            this.gbGenerator.Controls.Add(chkDigits);
            this.gbGenerator.Controls.Add(chkSymbols);
            this.gbGenerator.Controls.Add(btnGenerate);

            // btnSave
            this.btnSave.Text = "СОХРАНИТЬ";
            this.btnSave.BackColor = Color.FromArgb(27, 58, 107);
            this.btnSave.ForeColor = Color.White;
            this.btnSave.FlatStyle = FlatStyle.Flat;
            this.btnSave.Location = new Point(20, 340);
            this.btnSave.Size = new Size(210, 40);
            this.btnSave.Click += new System.EventHandler(this.btnSave_Click);

            // btnCancel
            this.btnCancel.Text = "ОТМЕНА";
            this.btnCancel.BackColor = Color.Gray;
            this.btnCancel.ForeColor = Color.White;
            this.btnCancel.FlatStyle = FlatStyle.Flat;
            this.btnCancel.Location = new Point(250, 340);
            this.btnCancel.Size = new Size(210, 40);
            this.btnCancel.Click += new System.EventHandler(this.btnCancel_Click);

            this.Controls.Add(lblTitle);
            this.Controls.Add(lblService);
            this.Controls.Add(txtService);
            this.Controls.Add(lblLogin);
            this.Controls.Add(txtLogin);
            this.Controls.Add(lblPassword);
            this.Controls.Add(txtPassword);
            this.Controls.Add(btnTogglePassword);
            this.Controls.Add(gbGenerator);
            this.Controls.Add(btnSave);
            this.Controls.Add(btnCancel);

            this.ResumeLayout(false);
        }
    }
}
