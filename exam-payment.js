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

    const priceDisplay = document.getElementById('exam-price-display');
    if (priceDisplay) { priceDisplay.textContent = `${price} AZN`; }

    paymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const guestData = {
            examId: examId,
            guestName: document.getElementById('name').value,
            guestEmail: document.getElementById('email').value
        };
        const button = e.target.querySelector('.submit-btn');
        button.textContent = 'Gözləyin...';
        button.disabled = true;

        // === DÜZGÜN ÜNVAN BUDUR ===
        fetch('/api/create-guest-payment-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guestData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.paymentUrl) {
                window.location.href = data.paymentUrl;
            } else {
                alert('Xəta: ' + (data.error || 'Naməlum xəta'));
                button.textContent = 'Ödəniş Et';
                button.disabled = false;
            }
        })
        .catch(err => {
            alert('Ödənişə başlamaq mümkün olmadı.');
            button.textContent = 'Ödəniş Et';
            button.disabled = false;
        });
    });
});