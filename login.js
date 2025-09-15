// login.js faylının yeni və tam kodu

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');

    // "async" ilə funksiyanı təyin edirik ki, içində "await" istifadə edə bilək
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const loginData = { email: email, password: password };

        try {
            // Addım 1: Admin kimi yoxla
            let response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData),
                credentials: 'include'
            });

            if (response.ok) {
                alert('Admin girişi uğurludur!');
                window.location.href = 'admin-dashboard.html';
                return; // Prosesi dayandır
            }

            // Addım 2: Müəllim kimi yoxla
            response = await fetch('/api/teacher/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData),
                credentials: 'include'
            });

            if (response.ok) {
                alert('Müəllim girişi uğurludur!');
                window.location.href = 'teacher-dashboard.html';
                return; // Prosesi dayandır
            }

            // Addım 3: Şagird kimi yoxla
            response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData),
                credentials: 'include'
            });

            if (response.ok) {
                const result = await response.json();
                alert(result.message);
                window.location.href = 'profile.html';
                return; // Prosesi dayandır
            }
            
            // Əgər heç biri uğurlu olmadısa, sonuncu xəta mesajını göstər
            const errorResult = await response.json();
            alert(errorResult.message || 'E-poçt və ya şifrə yanlışdır.');

        } catch (error) {
            console.error('Giriş zamanı xəta:', error);
            alert('Giriş zamanı xəta baş verdi. Serverin işlədiyindən əmin olun.');
        }
    });
});