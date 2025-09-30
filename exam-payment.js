// exam-payment.js faylını bununla tam əvəz edin
document.addEventListener('DOMContentLoaded', () => {
    const paymentForm = document.querySelector('.payment-card form'); 
    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    const price = urlParams.get('price'); // URL-dən qiyməti alırıq

    if (!examId) {
        alert('İmtahan ID-si tapılmadı!');
        window.location.href = 'exam.html';
        return;
    }

    // Qiyməti səhifədə göstəririk
    const priceDisplay = document.getElementById('exam-price-display');
    if (priceDisplay && price) {
        priceDisplay.textContent = `${price} AZN`;
    }

    if(paymentForm) {
        paymentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Həm adı, həm də yeni əlavə etdiyimiz e-poçtu götürürük
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;

            // URL-ə həm studentName, həm də studentEmail parametrlərini əlavə edirik
            window.location.href = `exam-test.html?examId=${examId}&studentName=${encodeURIComponent(name)}&studentEmail=${encodeURIComponent(email)}`;
        });
    }
});