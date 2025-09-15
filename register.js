document.addEventListener('DOMContentLoaded', function() {
    const registrationForm = document.getElementById('registration-form');

    registrationForm.addEventListener('submit', function(event) {
        event.preventDefault();

        const formData = new FormData(registrationForm);
        const data = Object.fromEntries(formData.entries());

        // URL-dən dəvət kodunu götürürük
        const params = new URLSearchParams(window.location.search);
        const inviteCode = params.get('ref');
        if (inviteCode) {
            data.invite_code = inviteCode; // Əgər kod varsa, sorğuya əlavə edirik
        }

        fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
        .then(response => response.json())
        .then(result => {
            alert(result.message); 
            if (result.message === 'Qeydiyyat uğurlu oldu!') {
                window.location.href = 'login.html'; // Qeydiyyatdan sonra login səhifəsinə yönləndiririk
            }
        })
        .catch(error => {
            console.error('Xəta:', error);
            alert('Qeydiyyat zamanı xəta baş verdi.');
        });
    });
});