using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows.Forms;

namespace PasswordVault
{
    public partial class MainForm : Form
    {
        private List<PasswordEntry> _entries;

        public MainForm()
        {
            InitializeComponent();
            _entries = VaultStorage.Load();
            RefreshGrid();
        }

        private void RefreshGrid(string filter = "")
        {
            dgvPasswords.Rows.Clear();
            var displayList = string.IsNullOrEmpty(filter) || filter == "🔍 Поиск сервиса..."
                ? _entries
                : _entries.Where(e => e.ServiceName.IndexOf(filter, StringComparison.OrdinalIgnoreCase) >= 0).ToList();

            foreach (var entry in displayList)
            {
                dgvPasswords.Rows.Add(entry.ServiceName, entry.Login, "••••••");
            }
        }

        private void txtSearch_TextChanged(object sender, EventArgs e)
        {
            RefreshGrid(txtSearch.Text);
        }

        private void dgvPasswords_CellContentClick(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex < 0) return;

            var entry = _entries[e.RowIndex]; // Simplified: assume index matches grid
            string decrypted = EncryptionHelper.Decrypt(entry.Password);

            switch (dgvPasswords.Columns[e.ColumnIndex].Name)
            {
                case "Show":
                    MessageBox.Show(decrypted, entry.ServiceName);
                    break;
                case "Copy":
                    Clipboard.SetText(decrypted);
                    MessageBox.Show("Скопировано!", "Успех");
                    break;
                case "Edit":
                    AddEntryForm editForm = new AddEntryForm(entry);
                    if (editForm.ShowDialog() == DialogResult.OK)
                    {
                        _entries[e.RowIndex] = editForm.ResultEntry;
                        VaultStorage.Save(_entries);
                        RefreshGrid();
                    }
                    break;
                case "Delete":
                    if (MessageBox.Show("Удалить запись?", "Подтверждение", MessageBoxButtons.YesNo) == DialogResult.Yes)
                    {
                        _entries.RemoveAt(e.RowIndex);
                        VaultStorage.Save(_entries);
                        RefreshGrid();
                    }
                    break;
            }
        }

        private void btnAddNew_Click(object sender, EventArgs e)
        {
            AddEntryForm addForm = new AddEntryForm();
            if (addForm.ShowDialog() == DialogResult.OK)
            {
                _entries.Add(addForm.ResultEntry);
                VaultStorage.Save(_entries);
                RefreshGrid();
            }
        }
    }
}
