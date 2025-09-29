// exam-payment.js - YEKUN VƏ TAM KOD
document.addEventListener('DOMContentLoaded', () => {
    const paymentForm = document.getElementById('payment-form');
    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    const price = urlParams.get('price');

    if (!examId || !price) {
        alert('İmtahan məlumatları tapılmadı!');
        window.location.href = 'exam.html';
        return;
    }

    // Qiyməti səhifədə göstəririk
    const priceDisplay = document.getElementById('exam-price-display');
    if (priceDisplay) {
        priceDisplay.textContent = `${price} AZN`;
    }

    paymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const button = e.target.querySelector('.submit-btn');

        const guestData = {
            examId: examId,
            guestName: nameInput.value,
            guestEmail: emailInput.value
        };

        button.textContent = 'Gözləyin...';
        button.disabled = true;

        // Qonaqlar üçün olan xüsusi funksiyaya sorğu göndəririk
        fetch('/api/create-guest-payment-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guestData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.paymentUrl) {
                // Uğurlu olarsa, Payriff-ə yönləndiririk
                window.location.href = data.paymentUrl;
            } else {
                alert('Xəta: ' + (data.error || 'Naməlum xəta'));
                button.textContent = 'Ödəniş Et';
                button.disabled = false;
            }
        })
        .catch(err => {
            alert('Ödənişə başlamaq mümkün olmadı. Zəhmət olmasa, səhifəni yeniləyib təkrar yoxlayın.');
            button.textContent = 'Ödəniş Et';
            button.disabled = false;
        });
    });
});