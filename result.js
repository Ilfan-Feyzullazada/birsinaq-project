document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const submissionId = urlParams.get('submission_id');

    // === SƏHİFƏDƏKİ BÜTÜN DÜZGÜN ELEMENTLƏRİ SEÇİRİK ===
    const resultContainer = document.getElementById('result-container');
    const examDetailsContainer = document.getElementById('exam-details');
    const finalScoreValue = document.getElementById('final-score-value');
    const correctCount = document.getElementById('correct-count');
    const incorrectCount = document.getElementById('incorrect-count');
    const unansweredCount = document.getElementById('unanswered-count');
    const downloadBtn = document.getElementById('download-cert-btn');

    // YENİ sertifikat şablonu üçün elementlər
    const newCertName = document.getElementById('cert-name-new');
    const newCertScore = document.getElementById('cert-score-new');
    const newCertDate = document.getElementById('cert-date-new');
    
    if (!submissionId) {
        if(resultContainer) resultContainer.innerHTML = `<p style="color: red; text-align: center;">Nəticə ID-si tapılmadı!</p>`;
        return;
    }

    // === MƏLUMATLARI SERVERDƏN BİR DƏFƏ ÇƏKİB HƏR YERİ DOLDURURUQ ===
    fetch(`/api/submission/${submissionId}/result`, { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.message || 'Nəticələri yükləmək mümkün olmadı.') });
            }
            return response.json();
        })
        .then(data => {
            // 1. Ümumi məlumatları doldururuq (YENİ DİZAYN İLƏ)
            if(examDetailsContainer) {
                examDetailsContainer.innerHTML = `
                <div class="exam-details-grid">
                    <div class="detail-item">
                        <i class="fas fa-book-open"></i>
                        <div>
                            <span class="label">İmtahan Növü</span>
                            <span class="value">${data.exam_type || 'N/A'} - ${data.exam_class || ''}</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-file-alt"></i>
                        <div>
                            <span class="label">İmtahan Adı</span>
                            <span class="value">${data.exam_title || 'Adsız'}</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-calendar-alt"></i>
                        <div>
                            <span class="label">Tarix</span>
                            <span class="value">${data.submission_date || 'Tarix yoxdur'}</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-user-graduate"></i>
                        <div>
                            <span class="label">Şagird</span>
                            <span class="value">${data.student_name || 'Adsız'}</span>
                        </div>
                    </div>
                </div>
            `;
            }

            // 2. Statistika xanalarını doldururuq
            if(finalScoreValue) finalScoreValue.textContent = data.stats?.final_score ?? 'N/A';
            if(correctCount) correctCount.textContent = data.stats?.correct_count ?? 0;
            if(incorrectCount) incorrectCount.textContent = data.stats?.incorrect_count ?? 0;
            if(unansweredCount) unansweredCount.textContent = data.stats?.unanswered_count ?? 0;

            // 3. Detallı nəticə cədvəllərini yaradırıq (Sizin kodunuzda olan hissə)
            let resultsHTML = '';
            let hasPendingQuestions = false;

            if (data.results && data.results.length > 0) {
                data.results.forEach(subjectData => {
                    const subjectScoreInfo = data.stats.subjects[subjectData.subject_name];
                    const subjectScoreText = subjectScoreInfo ? `( ${subjectScoreInfo.score.toFixed(2)} bal )` : '';

                    resultsHTML += `
                        <div class="subject-block">
                            <h3>${subjectData.subject_name} <span class="subject-score">${subjectScoreText}</span></h3>
                            <table class="result-table">
                                <thead>
                                    <tr class="header-row">
                                        <th>Sıra</th>
                                        <th>Sual</th>
                                        <th>Sizin Cavabınız</th>
                                        <th>Düzgün Cavab</th>
                                        <th>Sərf Olunan Vaxt</th>
                                        <th>Mövzu</th>
                                    </tr>
                                </thead>
                                <tbody>`;

                    subjectData.questions.forEach((q, index) => {
                        let rowClass = '';
                        let isCorrect = false;

                        if (q.student_answer && typeof q.student_answer === 'string' && q.student_answer.startsWith('[')) {
                            try { q.student_answer = JSON.parse(q.student_answer); } catch (e) { }
                        }
                        
                        if (Array.isArray(q.student_answer) && Array.isArray(q.correct_answer)) {
                            const sortedStudentAnswer = JSON.stringify([...q.student_answer].sort());
                            const sortedCorrectAnswer = JSON.stringify([...q.correct_answer].sort());
                            isCorrect = sortedStudentAnswer === sortedCorrectAnswer;
                        } else {
                            isCorrect = String(q.student_answer).toLowerCase() === String(q.correct_answer).toLowerCase();
                        }

                        if (q.status === 'pending_review') {
                            hasPendingQuestions = true;
                            rowClass = 'pending-answer';
                        } else if (!q.student_answer || q.student_answer.toString().trim() === '' || q.student_answer.toString() === '[]') {
                            rowClass = 'unanswered-row';
                        } else if (isCorrect) {
                            rowClass = 'correct-answer';
                        } else {
                            rowClass = 'incorrect-answer';
                        }
                        
                        let questionTitleHTML = `${index + 1}`;
                        if (data.video_url && q.video_start_time) {
                            function getYouTubeID(url) {
                                const arr = url.split(/(vi\/|v%3D|v=|\/v\/|youtu\.be\/|\/embed\/)/);
                                return arr[2] !== undefined ? arr[2].split(/[?&]/)[0] : arr[0];
                            }
                            const videoId = getYouTubeID(data.video_url);
                            if (videoId) {
                                let videoLink = `https://www.youtube.com/watch?v=${videoId}&t=${q.video_start_time}s`;
                                questionTitleHTML = `<a href="${videoLink}" target="_blank" title="Videoizaha bax" style="text-decoration: none; color: inherit;">${index + 1} <i class="fas fa-play-circle"></i></a>`;
                            }
                        }

                        const timeSpentMs = (data.time_spent && data.time_spent[q.question_id]) ? data.time_spent[q.question_id] : 0;
                        let formattedTime = '0 san';
                        if (timeSpentMs > 0) {
                            const minutes = Math.floor(timeSpentMs / 60000);
                            const seconds = ((timeSpentMs % 60000) / 1000).toFixed(0);
                            formattedTime = minutes > 0 ? `${minutes} dəq ${seconds} san` : `${seconds} san`;
                        }

                        const topic = q.topic || 'Təyin edilməyib';

                        resultsHTML += `
                            <tr class="${rowClass}">
                                <td>${questionTitleHTML}</td>
                                <td>${q.question_text}</td>
                                <td>${Array.isArray(q.student_answer) ? q.student_answer.join(', ') : (q.student_answer || 'Boş')}</td>
                                <td>${q.status === 'pending_review' ? 'Yoxlanılır...' : (Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : q.correct_answer)}</td>
                                <td>${formattedTime}</td>
                                <td>${topic}</td>
                            </tr>
                        `;
                    });
                    resultsHTML += `</tbody></table></div>`;
                });
            }

            if (hasPendingQuestions && !resultsHTML.includes('pending-notification')) {
                resultsHTML += `<div class="pending-notification" style="background-color: #fff3cd; border-left: 5px solid #ffeeba; padding: 15px; margin-top: 20px; border-radius: 5px;"><p><strong>Qeyd:</strong> Sarı rəngli sətirlər müəllim yoxlaması gözləyən cavablardır. Yekun nəticə müəllim yoxladıqdan sonra hesablanacaq.</p></div>`;
            }

            if(resultContainer) resultContainer.innerHTML = resultsHTML;

            // 4. YENİ sertifikat şablonunu məlumatlarla doldururuq
            if (newCertName) newCertName.textContent = data.student_name || '[AD SOYAD]';
            if (newCertScore) newCertScore.textContent = data.stats?.final_score ?? '[Bal]';
            if (newCertDate) newCertDate.textContent = data.submission_date || '[Tarix]';
        })
        .catch(error => {
            console.error("Nəticə səhifəsində xəta:", error);
            if(resultContainer) resultContainer.innerHTML = `<p style="color: red; text-align: center;">Xəta baş verdi: ${error.message}</p>`;
        });


    // 5. PDF yükləmə düyməsi üçün DÜZGÜN listener
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const certificateElement = document.getElementById('new-certificate-template');
            if (!certificateElement) {
                alert("Sertifikat şablonu HTML-də tapılmadı! Zəhmət olmasa, 'result.html' faylını yoxlayın.");
                return;
            }
        
            const { jsPDF } = window.jspdf;
            const studentNameForFile = newCertName ? (newCertName.textContent || 'telebe') : 'telebe';

            certificateElement.parentElement.style.left = '0px';

            html2canvas(certificateElement, { scale: 3, useCORS: true }).then(canvas => {
                certificateElement.parentElement.style.left = '-9999px';
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`${studentNameForFile}-sertifikat.pdf`);
            }).catch(err => {
                console.error("PDF yaradılarkən xəta:", err);
                alert("PDF yaradılarkən xəta baş verdi. Brauzer konsoluna baxın.");
                certificateElement.parentElement.style.left = '-9999px';
            });
        });
    }
});