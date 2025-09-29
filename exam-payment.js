// exam-payment.js faylının içindəki hər şeyi silib bunu yapışdırın

document.addEventListener('DOMContentLoaded', () => {
    const paymentForm = document.getElementById('payment-form');
    const priceDisplay = document.getElementById('exam-price-display');

    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    const price = urlParams.get('price');

    // --- İlkin Yoxlamalar ---
    if (!examId || !price) {
        alert('İmtahan məlumatları (ID və ya Qiymət) tapılmadı!');
        window.location.href = 'exam.html'; // İstifadəçini imtahan siyahısına qaytar
        return;
    }

    // Qiyməti səhifədə göstəririk
    priceDisplay.textContent = `${price} AZN`;
    
    // --- Əsas Ödəniş Məntiqi ---
    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Formanın standart göndərilməsinin qarşısını alırıq

        const submitBtn = paymentForm.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gözləyin...'; // İstifadəçiyə prosesin getdiyini göstəririk

        try {
            // 1. BACKEND-Ə MÜRACİƏT EDİRİK Kİ, BİZƏ PAYRIFF LİNKİ VERSİN
            const response = await fetch('/api/create-payment-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ examId: examId })
            });

            const data = await response.json();

            // 2. BACKEND-DƏN GƏLƏN CAVABI YOXLAYIRIQ
            if (response.ok && data.paymentUrl) {
                // 3. ƏGƏR HƏR ŞEY UĞURLUDURSA, İSTİFADƏÇİNİ PAYRIFF SƏHİFƏSİNƏ YÖNLƏNDİRİRİK
                window.location.href = data.paymentUrl;
            } else {
                // Əgər backend xəta qaytarsa (məsələn, imtahan tapılmasa)
                alert('Ödəniş linki yaradıla bilmədi: ' + (data.error || 'Naməlum xəta.'));
                submitBtn.disabled = false;
                submitBtn.textContent = 'Ödəniş Et';
            }

        } catch (error) {
            // İnternet xətası və ya başqa bir problem olarsa
            console.error('Ödəniş sorğusu zamanı şəbəkə xətası:', error);
            alert('Ödəniş sistemi ilə əlaqə qurmaq mümkün olmadı. İnternet bağlantınızı yoxlayın.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Ödəniş Et';
        }
    });
});