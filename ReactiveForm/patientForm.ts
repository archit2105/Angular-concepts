import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { PatientService } from '../../core/services/patient.service';
import { PatientEnrollment } from '../../models/patient.model';
import { finalize } from 'rxjs';
@Component({
 selector: 'app-patient-enrollment',
 templateUrl: './patient-enrollment.component.html',
 styleUrls: ['./patient-enrollment.component.scss']
})
export class PatientEnrollmentComponent implements OnInit {
 enrollmentForm!: FormGroup;   // Main reactive form
 selectedFile!: File;          // Holds selected medical report
 loading = false;              // Controls submit button state
 errorMessage = '';            // Stores error messages for UI
 constructor(
   private fb: FormBuilder,
   private patientService: PatientService
 ) {}
 ngOnInit(): void {
   this.initializeForm();
 }
 /**
  * Initializes reactive form with validators
  */
 private initializeForm(): void {
   this.enrollmentForm = this.fb.group({
     patientId: [{ value: this.generatePatientId(), disabled: true }],
     fullName: ['', [Validators.required, Validators.minLength(3)]],
     email: ['', [Validators.required, Validators.email]],
     phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
     dob: ['', [Validators.required, this.ageValidator]],
     gender: ['', Validators.required],
     bloodGroup: ['', Validators.required],
     conditions: [[]],
     emergencyName: ['', Validators.required],
     emergencyPhone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
     consent: [false, Validators.requiredTrue]
   });
 }
 /**
  * Custom validator to ensure patient is at least 18 years old
  */
 private ageValidator(control: AbstractControl) {
   if (!control.value) return null;
   const birthDate = new Date(control.value);
   const today = new Date();
   let age = today.getFullYear() - birthDate.getFullYear();
   const monthDiff = today.getMonth() - birthDate.getMonth();
   // Adjust age if birthday hasn't occurred yet this year
   if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
     age--;
   }
   return age >= 18 ? null : { underAge: true };
 }
 /**
  * Generates unique patient ID using timestamp
  */
 private generatePatientId(): string {
   return `PAT-${Date.now()}`;
 }
 /**
  * Handles file selection and validation
  */
 onFileChange(event: Event): void {
   const input = event.target as HTMLInputElement;
   if (!input.files?.length) return;
   const file = input.files[0];
   const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
   // Validate file type
   if (!allowedTypes.includes(file.type)) {
     this.errorMessage = 'Invalid file type. Only PDF, JPG, PNG allowed.';
     return;
   }
   // Validate file size (Max 5MB)
   if (file.size > 5 * 1024 * 1024) {
     this.errorMessage = 'File size must not exceed 5MB.';
     return;
   }
   this.selectedFile = file;
   this.errorMessage = '';
 }
 /**
  * Handles form submission
  * Flow:
  * 1. Get S3 presigned URL from backend
  * 2. Upload file directly to S3
  * 3. Save patient enrollment data
  */
 onSubmit(): void {
   if (this.enrollmentForm.invalid || !this.selectedFile) {
     this.enrollmentForm.markAllAsTouched();
     return;
   }
   this.loading = true;
   this.patientService
     .getPresignedUrl(this.selectedFile.name, this.selectedFile.type)
     .subscribe({
       next: (res) => {
         this.patientService
           .uploadToS3(res.uploadUrl, this.selectedFile)
           .subscribe(() => {
             const payload: PatientEnrollment = {
               ...this.enrollmentForm.getRawValue(),
               reportUrl: res.fileUrl
             };
             this.patientService
               .enrollPatient(payload)
               .pipe(finalize(() => this.loading = false))
               .subscribe({
                 next: () => {
                   alert('Patient enrolled successfully');
                   this.enrollmentForm.reset();
                 },
                 error: () => {
                   this.errorMessage = 'Enrollment failed. Please try again.';
                 }
               });
           });
       },
       error: () => {
         this.loading = false;
         this.errorMessage = 'File upload failed.';
       }
     });
 }
 // Getter for easy access in template
 get f() {
   return this.enrollmentForm.controls;
 }
}