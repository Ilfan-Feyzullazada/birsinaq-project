document.addEventListener('DOMContentLoaded', () => {
    const examListContainer = document.querySelector('.exam-list');
    const titleElement = document.getElementById('exam-list-title');
    const urlParams = new URLSearchParams(window.location.search);
    const examType = urlParams.get('type');
    const examGrade = urlParams.get('grade');

    if (titleElement) {
        titleElement.textContent = examGrade && examType ? `${examGrade} üçün ${examType} İmtahanları` : 'Aktiv İmtahanlar';
    }

    if (!examType || !examGrade) {
        examListContainer.innerHTML = '<p style="text-align: center; color: red;">İmtahan növü və ya sinif seçilməyib.</p>';
        return;
    }

    // Yoxlayırıq ki, istifadəçi qeydiyyatdan keçib ya yox (profil linkinin olub-olmaması ilə)
    const isUserLoggedIn = !!document.querySelector('a[href="profile.html"]');

    fetch(`/api/exams?type=${encodeURIComponent(examType)}&grade=${encodeURIComponent(examGrade)}`, { credentials: 'include' })
        .then(response => response.json())
        .then(exams => {
            examListContainer.innerHTML = '';
            if (exams.length === 0) {
                examListContainer.innerHTML = '<p style="text-align: center;">Bu kateqoriya üzrə aktiv imtahan tapılmadı.</p>';
                return;
            }

            exams.forEach(exam => {
                const examItem = document.createElement('div');
                examItem.className = 'exam-item';

                let actionHTML = '';
                const priceText = exam.price > 0 ? `${exam.price.toFixed(2)} AZN` : 'Pulsuz';

                if (exam.is_taken) {
                    // Əgər istifadəçi bu imtahanı artıq alıbsa, nəticəyə baxmaq üçün link göstərilir
                    actionHTML = `<a href="result.html?submission_id=${exam.submission_id}" class="payment-btn view-result">Nəticəyə Bax</a>`;
                } else if (exam.price <= 0) {
                    // İmtahan pulsuzdursa, birbaşa iştirak linki
                    actionHTML = `<a href="exam-test.html?examId=${exam.id}" class="payment-btn">İştirak Et</a>`;
                } else {
                    // İmtahan pulludursa, ödəniş düyməsi
                    actionHTML = `<a href="#" class="payment-btn" data-exam-id="${exam.id}" data-price="${exam.price}">İştirak Et</a>`;
                }

                examItem.innerHTML = `
                    <div class="exam-info">
                        <h4>${exam.title}</h4>
                        <p>Təşkilatçı: BirSınaq</p>
                    </div>
                    <div class="exam-actions">
                        <span class="exam-price">${priceText}</span>
                        ${actionHTML}
                    </div>
                `;
                examListContainer.appendChild(examItem);
            });
        })
        .catch(error => {
            console.error('İmtahanları yükləyərkən xəta:', error);
            examListContainer.innerHTML = '<p style="text-align: center; color: red;">İmtahanları yükləmək mümkün olmadı.</p>';
        });

    examListContainer.addEventListener('click', (e) => {
        const paymentButton = e.target.closest('.payment-btn');
        if (paymentButton && paymentButton.dataset.examId) {
            e.preventDefault();
            const examId = paymentButton.dataset.examId;
            const price = paymentButton.dataset.price;

            if (!isUserLoggedIn && price > 0) {
                // Qonaqdırsa və imtahan pulludursa, məlumat daxil etmə səhifəsinə yönləndir
                window.location.href = `exam-payment.html?examId=${examId}&price=${price}`;
            } else {
                // Qeydiyyatlıdırsa, birbaşa ödəniş prosesini başlat
                initiatePayment(examId, paymentButton);
            }
        }
    });
});

function initiatePayment(examId, button) {
    button.textContent = 'Gözləyin...';
    button.style.pointerEvents = 'none';

    fetch('/api/create-payment-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ examId: examId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.paymentUrl) {
            window.location.href = data.paymentUrl;
        } else {
            alert('Xəta: ' + (data.error || 'Naməlum xəta'));
            button.textContent = 'İştirak Et';
            button.style.pointerEvents = 'auto';
        }
    })
    .catch(err => {
        alert('Ödənişə başlamaq mümkün olmadı.');
        button.textContent = 'İştirak Et';
        button.style.pointerEvents = 'auto';
    });
}