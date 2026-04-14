using System.Drawing;
using System.Windows.Forms;

namespace PasswordVault
{
    partial class MainForm
    {
        private System.ComponentModel.IContainer components = null;
        private Panel pnlTop;
        private Label lblLogo;
        private TextBox txtSearch;
        private DataGridView dgvPasswords;
        private Button btnAddNew;

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
            this.pnlTop = new Panel();
            this.lblLogo = new Label();
            this.txtSearch = new TextBox();
            this.dgvPasswords = new DataGridView();
            this.btnAddNew = new Button();

            this.SuspendLayout();

            // Form
            this.ClientSize = new Size(900, 600);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Text = "КриптоСейф";

            // pnlTop
            this.pnlTop.Dock = DockStyle.Top;
            this.pnlTop.Height = 60;
            this.pnlTop.BackColor = Color.FromArgb(27, 58, 107);

            // lblLogo
            this.lblLogo.Text = "🔐 КриптоСейф";
            this.lblLogo.ForeColor = Color.White;
            this.lblLogo.Font = new Font("Segoe UI", 18F, FontStyle.Bold);
            this.lblLogo.TextAlign = ContentAlignment.MiddleLeft;
            this.lblLogo.Location = new Point(20, 10);
            this.lblLogo.Size = new Size(300, 40);

            // txtSearch
            this.txtSearch.Dock = DockStyle.Top;
            this.txtSearch.Height = 35;
            this.txtSearch.Font = new Font("Segoe UI", 12F);
            this.txtSearch.Text = "🔍 Поиск сервиса...";
            this.txtSearch.ForeColor = Color.Gray;
            this.txtSearch.Enter += (s, e) => { if (txtSearch.Text == "🔍 Поиск сервиса...") { txtSearch.Text = ""; txtSearch.ForeColor = Color.Black; } };
            this.txtSearch.Leave += (s, e) => { if (string.IsNullOrEmpty(txtSearch.Text)) { txtSearch.Text = "🔍 Поиск сервиса..."; txtSearch.ForeColor = Color.Gray; } };
            this.txtSearch.TextChanged += new System.EventHandler(this.txtSearch_TextChanged);

            // dgvPasswords
            this.dgvPasswords.Dock = DockStyle.Fill;
            this.dgvPasswords.AllowUserToAddRows = false;
            this.dgvPasswords.RowHeadersVisible = false;
            this.dgvPasswords.ReadOnly = true;
            this.dgvPasswords.BackgroundColor = Color.White;
            this.dgvPasswords.AlternatingRowsDefaultCellStyle.BackColor = Color.FromArgb(235, 240, 250);
            this.dgvPasswords.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            this.dgvPasswords.CellContentClick += new DataGridViewCellEventHandler(this.dgvPasswords_CellContentClick);

            // Columns
            this.dgvPasswords.Columns.Add("ServiceName", "Сервис");
            this.dgvPasswords.Columns[0].Width = 200;
            this.dgvPasswords.Columns.Add("Login", "Логин");
            this.dgvPasswords.Columns[1].Width = 200;
            this.dgvPasswords.Columns.Add("Password", "Пароль");
            this.dgvPasswords.Columns[2].Width = 150;

            var colShow = new DataGridViewButtonColumn { Name = "Show", HeaderText = "Показать", Text = "👁", UseColumnTextForButtonValue = true, Width = 60 };
            this.dgvPasswords.Columns.Add(colShow);
            var colCopy = new DataGridViewButtonColumn { Name = "Copy", HeaderText = "Копировать", Text = "📋", UseColumnTextForButtonValue = true, Width = 80 };
            this.dgvPasswords.Columns.Add(colCopy);
            var colEdit = new DataGridViewButtonColumn { Name = "Edit", HeaderText = "Изменить", Text = "✏️", UseColumnTextForButtonValue = true, Width = 70 };
            this.dgvPasswords.Columns.Add(colEdit);
            var colDelete = new DataGridViewButtonColumn { Name = "Delete", HeaderText = "Удалить", Text = "🗑", UseColumnTextForButtonValue = true, Width = 70 };
            this.dgvPasswords.Columns.Add(colDelete);

            // btnAddNew
            this.btnAddNew.Dock = DockStyle.Bottom;
            this.btnAddNew.Height = 45;
            this.btnAddNew.Text = "+ ДОБАВИТЬ НОВУЮ ЗАПИСЬ";
            this.btnAddNew.BackColor = Color.FromArgb(27, 58, 107);
            this.btnAddNew.ForeColor = Color.White;
            this.btnAddNew.FlatStyle = FlatStyle.Flat;
            this.btnAddNew.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
            this.btnAddNew.Click += new System.EventHandler(this.btnAddNew_Click);

            this.pnlTop.Controls.Add(lblLogo);
            this.Controls.Add(dgvPasswords);
            this.Controls.Add(txtSearch);
            this.Controls.Add(pnlTop);
            this.Controls.Add(btnAddNew);

            this.ResumeLayout(false);
        }
    }
}
