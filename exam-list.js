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

    // Backend-dən imtahan siyahısını çəkirik
    fetch(`/api/exams?type=${encodeURIComponent(examType)}&grade=${encodeURIComponent(examGrade)}`, { credentials: 'include' })
        .then(response => {
            // Əgər istifadəçi daxil olmayıbsa (401 xətası), login səhifəsinə yönləndiririk
            if (!response.ok) { 
                window.location.href = 'login.html';
                throw new Error('Giriş edilməyib');
            }
            return response.json();
        })
        .then(exams => {
            examListContainer.innerHTML = '';
            if (exams.length === 0) {
                examListContainer.innerHTML = '<p style="text-align: center;">Bu kateqoriya üzrə aktiv imtahan tapılmadı.</p>';
                return;
            }

            exams.forEach(exam => {
                const examItem = document.createElement('div');
                examItem.className = 'exam-item';

                let actionHTML;
                const priceText = exam.price > 0 ? `${exam.price.toFixed(2)} AZN` : 'Pulsuz';

                // === ƏSAS DƏYİŞİKLİK BURADADIR ===
                // Backend-dən gələn `is_paid` statusunu yoxlayırıq
                if (exam.is_paid || exam.price <= 0) {
                    // Əgər ödənilibsə və ya pulsuzdursa, birbaşa imtahana keçid veririk
                    actionHTML = `<a href="exam-test.html?examId=${exam.id}" class="start-btn">İmtahana Başla</a>`;
                } else {
                    // Əgər ödənilməyibsə, ödəniş düyməsini göstəririk
                    actionHTML = `<a href="#" class="payment-btn" data-exam-id="${exam.id}">İştirak Et (${priceText})</a>`;
                }

                examItem.innerHTML = `
                    <div class="exam-info">
                        <h4>${exam.title}</h4>
                        <p>Təşkilatçı: BirSınaq</p>
                    </div>
                    <div class="exam-actions">
                        ${actionHTML}
                    </div>
                `;
                examListContainer.appendChild(examItem);
            });
        })
        .catch(error => {
            console.error('İmtahanları yükləyərkən xəta:', error);
            // "Giriş edilməyib" xətasıdırsa, səhifədə əlavə mesaj göstərməyə ehtiyac yoxdur
            if (error.message !== 'Giriş edilməyib') {
                examListContainer.innerHTML = '<p style="text-align: center; color: red;">İmtahanları yükləmək mümkün olmadı.</p>';
            }
        });

    // Ödəniş düyməsinə klik hadisəsi (bu hissə düzgündür)
    examListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('payment-btn') && e.target.dataset.examId) {
            e.preventDefault();
            const examId = e.target.dataset.examId;
            const button = e.target;
            button.textContent = 'Gözləyin...';
            button.disabled = true;

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
                    button.textContent = `İştirak Et`;
                    button.disabled = false;
                }
            })
            .catch(err => {
                alert('Ödənişə başlamaq mümkün olmadı.');
                button.textContent = `İştirak Et`;
                button.disabled = false;
            });
        }
    });
});