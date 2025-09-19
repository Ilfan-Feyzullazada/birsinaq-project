document.addEventListener('DOMContentLoaded', function() {
    const registrationForm = document.getElementById('affiliate-registration-form');

    if (registrationForm) {
        registrationForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('password_confirm').value;

            if (password !== passwordConfirm) {
                alert('Daxil etdiyiniz şifrələr eyni deyil!');
                return;
            }

            const formData = new FormData(registrationForm);
            const data = Object.fromEntries(formData.entries());

            // URL-dən kordinatorun dəvət kodunu götürürük
            const params = new URLSearchParams(window.location.search);
            const inviteCode = params.get('ref');
            
            if (inviteCode) {
                data.invite_code = inviteCode; // Dəvət kodunu JSON datasına əlavə edirik
            } else {
                alert("Dəvət kodu tapılmadı! Zəhmət olmasa, kordinatorun göndərdiyi linklə daxil olun.");
                return;
            }

            // DÜZGÜN ÜNVANA SORĞU GÖNDƏRİRİK
            fetch('/api/affiliate/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            .then(response => response.json())
            .then(result => {
                alert(result.message); 
                if (result.message.includes('uğurla')) {
                    // Uğurlu qeydiyyatdan sonra kordinatorun giriş səhifəsinə yönləndiririk
                    window.location.href = 'organizer.html'; 
                }
            })
            .catch(error => {
                console.error('Xəta:', error);
                alert('Qeydiyyat zamanı xəta baş verdi.');
            });
        });
    }
});