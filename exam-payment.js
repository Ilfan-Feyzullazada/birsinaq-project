document.addEventListener('DOMContentLoaded', () => {
    const paymentForm = document.getElementById('payment-form');
    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    const price = urlParams.get('price');

    if (!examId) {
        alert('İmtahan ID-si tapılmadı!');
        window.location.href = 'exam.html';
        return;
    }

    const priceDisplay = document.getElementById('exam-price-display');
    if (priceDisplay && price) {
        priceDisplay.textContent = `${price} AZN`;
    }

    if (paymentForm) {
        paymentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const button = e.target.querySelector('button[type="submit"]');
            button.textContent = 'Gözləyin...';
            button.disabled = true;

            fetch('/api/create-payment-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    examId: examId,
                    guestName: document.getElementById('name').value,
                    guestEmail: document.getElementById('email').value
                })
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
    }
});