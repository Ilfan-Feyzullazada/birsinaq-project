document.addEventListener('DOMContentLoaded', function() {
    fetch('/api/profile', {
        credentials: 'include' // DƏYİŞİKLİK: Cookie-ləri göndərmək üçün bu sətir əlavə edildi
    })
    .then(response => {
        if (!response.ok) {
            window.location.href = 'login.html';
            throw new Error('Giriş edilməyib!');
        }
        return response.json();
    })
    .then(data => {
        document.getElementById('display-name').textContent = data.name;
        document.getElementById('display-contact').textContent = data.contact;
        document.getElementById('display-school').textContent = data.school;
        document.getElementById('display-class').textContent = data.class;
        document.getElementById('display-department').textContent = data.department;
        document.getElementById('display-language').textContent = data.language;
    })
    .catch(error => {
        console.error('Xəta:', error.message);
    });
});