import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { PatientEnrollmentComponent } from './patient-enrollment.component';
import { PatientService } from '../../core/services/patient.service';
import { of, throwError } from 'rxjs';

describe('PatientEnrollmentComponent', () => {
  let component: PatientEnrollmentComponent;
  let fixture: ComponentFixture<PatientEnrollmentComponent>;
  let mockPatientService: jasmine.SpyObj<PatientService>;

  beforeEach(async () => {
    // Mock the PatientService methods
    mockPatientService = jasmine.createSpyObj('PatientService', [
      'getPresignedUrl',
      'uploadToS3',
      'enrollPatient'
    ]);

    // Default mock returns
    mockPatientService.getPresignedUrl.and.returnValue(of({ uploadUrl: 'url', fileUrl: 'file-url' }));
    mockPatientService.uploadToS3.and.returnValue(of(null));
    mockPatientService.enrollPatient.and.returnValue(of({ success: true }));

    await TestBed.configureTestingModule({
      declarations: [ PatientEnrollmentComponent ],
      imports: [ ReactiveFormsModule ],
      providers: [
        { provide: PatientService, useValue: mockPatientService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PatientEnrollmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize the form as invalid', () => {
    expect(component.enrollmentForm.valid).toBeFalse();
  });

  describe('Email Validation (Strict Regex)', () => {
    it('should treat well-formatted emails as valid', () => {
      const emailControl = component.enrollmentForm.get('email');
      const validEmails = [
        'user@domain.com',
        'first.last@company.co.uk',
        'user123+tag@email.org',
        'my-name@domain.net'
      ];

      validEmails.forEach(email => {
        emailControl?.setValue(email);
        expect(emailControl?.valid).toBeTrue();
        expect(emailControl?.errors).toBeNull();
      });
    });

    it('should treat poorly formatted emails as invalid', () => {
      const emailControl = component.enrollmentForm.get('email');
      const invalidEmails = [
        'user@localhost',          // Missing TLD
        'user@domain.c',           // TLD too short
        '@domain.com',             // Missing username
        'user@.com',               // Missing domain
        'user example@domain.com'  // Contains space
      ];

      invalidEmails.forEach(email => {
        emailControl?.setValue(email);
        expect(emailControl?.valid).toBeFalse();
        expect(emailControl?.errors?.['pattern']).toBeTruthy();
      });
    });
  });

  describe('Date of Birth (Age Validation)', () => {
    it('should fail if patient is under 18', () => {
      const dobControl = component.enrollmentForm.get('dob');
      const today = new Date();
      // Set to exactly 17 years ago
      const underAgeDate = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate()).toISOString().split('T')[0];
      
      dobControl?.setValue(underAgeDate);
      expect(dobControl?.hasError('underAge')).toBeTrue();
    });

    it('should pass if patient is 18 or older', () => {
      const dobControl = component.enrollmentForm.get('dob');
      const today = new Date();
      // Set to exactly 19 years ago
      const adultDate = new Date(today.getFullYear() - 19, today.getMonth(), today.getDate()).toISOString().split('T')[0];
      
      dobControl?.setValue(adultDate);
      expect(dobControl?.hasError('underAge')).toBeFalse();
    });
  });

  describe('File Validation', () => {
    it('should set an error for invalid file types', () => {
      const file = new File([''], 'test.txt', { type: 'text/plain' });
      const event = { target: { files: [file] } } as unknown as Event;
      
      component.onFileChange(event);
      
      expect(component.errorMessage).toBe('Invalid file type. Only PDF, JPG, PNG allowed.');
      expect(component.selectedFile).toBeUndefined();
    });

    it('should set an error if file exceeds 5MB', () => {
      // Create a dummy file larger than 5MB
      const largeContent = new Array(6 * 1024 * 1024).fill('a').join('');
      const file = new File([largeContent], 'report.pdf', { type: 'application/pdf' });
      const event = { target: { files: [file] } } as unknown as Event;
      
      component.onFileChange(event);
      
      expect(component.errorMessage).toBe('File size must not exceed 5MB.');
      expect(component.selectedFile).toBeUndefined();
    });

    it('should accept valid files', () => {
      const file = new File(['dummy content'], 'report.pdf', { type: 'application/pdf' });
      const event = { target: { files: [file] } } as unknown as Event;
      
      component.onFileChange(event);
      
      expect(component.errorMessage).toBe('');
      expect(component.selectedFile).toEqual(file);
    });
  });

  describe('Form Submission', () => {
    it('should mark all fields as touched if form is invalid on submit', () => {
      spyOn(component.enrollmentForm, 'markAllAsTouched');
      component.onSubmit();
      expect(component.enrollmentForm.markAllAsTouched).toHaveBeenCalled();
      expect(mockPatientService.getPresignedUrl).not.toHaveBeenCalled();
    });
  });
});