// organizer.js

document.addEventListener('DOMContentLoaded', () => {
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // Tablar arasında keçid üçün
    if (loginTab && registerTab) {
        loginTab.addEventListener('click', () => {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        });

        registerTab.addEventListener('click', () => {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.style.display = 'block';
            loginForm.style.display = 'none';
        });
    }

    // --- Qeydiyyat Forması ---
    const regFormElement = document.querySelector('#register-form form');
    if (regFormElement) {
        regFormElement.addEventListener('submit', (e) => {
            e.preventDefault();

            const password = document.getElementById('reg-password').value;
            const passwordConfirm = document.getElementById('reg-password-confirm').value;

            if (password !== passwordConfirm) {
                alert('Daxil etdiyiniz şifrələr eyni deyil!');
                return;
            }

            const formData = new FormData(regFormElement);
            const data = Object.fromEntries(formData.entries());

            fetch('http://127.0.0.1:5000/api/organizer/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(res => res.json())
            .then(result => {
                alert(result.message);
                if (result.message === 'Qeydiyyat uğurlu oldu!') {
                    // Qeydiyyatdan sonra avtomatik "Daxil Ol" formasına keçir
                    loginTab.click();
                }
            })
            .catch(error => {
                console.error('Xəta:', error);
                alert('Qeydiyyat zamanı xəta baş verdi.');
            });
        });
    }

    // --- Giriş Forması ---
    const loginFormElement = document.querySelector('#login-form form');
    if (loginFormElement) {
        loginFormElement.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(loginFormElement);
            const data = Object.fromEntries(formData.entries());

            fetch('http://127.0.0.1:5000/api/organizer/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include' // Sessiyanın saxlanması üçün vacibdir!
            })
            .then(response => {
                // Cavabın uğurlu olub-olmamasını yoxlayırıq
                if (response.ok) {
                    return response.json();
                } else {
                    // Uğursuz olarsa, xəta mesajını göstəririk
                    return response.json().then(err => { throw new Error(err.message) });
                }
            })
            .then(result => {
                // Uğurlu cavab gələrsə, profil səhifəsinə yönləndiririk
                if (result.message === 'Giriş uğurludur!') {
                    window.location.href = 'organizer-profile.html';
                }
            })
            .catch(error => {
                console.error('Xəta:', error);
                alert(error.message); // Backend-dən gələn xəta mesajını göstəririk
            });
        });
    }
});