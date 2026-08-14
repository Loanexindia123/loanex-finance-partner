import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { VerificationService } from '../../../verification/services/verification.service';
import {
  AddressPayload,
  Gender,
  ProfileAddress,
  ProfileService,
  UpdatePersonalRequest,
} from '../../../checkout/services/profile.service';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

@Component({
  selector: 'app-my-profile',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './my-profile.html',
  styleUrl: './my-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly profileApi = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly verificationApi = inject(VerificationService);

  readonly states = INDIAN_STATES;
  readonly loading = signal(true);
  readonly savingPersonal = signal(false);
  readonly savingAddress = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly addresses = signal<ProfileAddress[]>([]);
  readonly editingAddressId = signal<string | null>(null);
  readonly showAddressForm = signal(false);
  readonly kycLoading = signal(false);
  readonly aadhaarVerified = signal(false);
  readonly panVerified = signal(false);
  readonly bankVerified = signal(false);

  readonly personalForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    mobile: [{ value: '', disabled: true }],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    dob: ['', [Validators.required]],
    gender: ['' as Gender | '', [Validators.required]],
  });

  readonly addressForm = this.fb.nonNullable.group({
    addressLine1: ['', [Validators.required, Validators.maxLength(120)]],
    addressLine2: ['', [Validators.required, Validators.maxLength(200)]],
    landmark: [''],
    city: ['', [Validators.required, Validators.maxLength(80)]],
    state: ['', [Validators.required]],
    pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    country: [{ value: 'India', disabled: true }],
    isDefault: [false],
  });

  ngOnInit(): void {
    this.load();
    this.loadKycStatus();
  }

  private loadKycStatus(): void {
    this.kycLoading.set(true);
    this.verificationApi.getStatus().subscribe({
      next: (status) => {
        this.kycLoading.set(false);
        this.aadhaarVerified.set(status.aadhaarVerified);
        this.panVerified.set(status.panVerified);
        this.bankVerified.set(status.bankVerified);
      },
      error: () => this.kycLoading.set(false),
    });
  }

  onPincodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(0, 6);
    this.addressForm.controls.pincode.setValue(value);
    input.value = value;
  }

  savePersonal(): void {
    this.personalForm.markAllAsTouched();
    if (this.personalForm.invalid) {
      this.error.set('Please correct the highlighted personal fields.');
      this.info.set(null);
      return;
    }

    const raw = this.personalForm.getRawValue();
    const payload: UpdatePersonalRequest = {
      fullName: raw.fullName.trim(),
      email: raw.email.trim(),
      dob: raw.dob,
      gender: raw.gender as Gender,
    };

    this.savingPersonal.set(true);
    this.error.set(null);
    this.info.set(null);

    this.profileApi.updatePersonal(payload).subscribe({
      next: () => {
        this.savingPersonal.set(false);
        this.auth.updateUser({
          fullName: payload.fullName,
          email: payload.email,
        });
        this.info.set('Personal details saved.');
      },
      error: () => {
        this.savingPersonal.set(false);
        this.error.set(this.profileApi.error() ?? 'Unable to save personal details.');
      },
    });
  }

  openAddAddress(): void {
    this.editingAddressId.set(null);
    this.addressForm.reset({
      addressLine1: '',
      addressLine2: '',
      landmark: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      isDefault: this.addresses().length === 0,
    });
    this.showAddressForm.set(true);
  }

  openEditAddress(address: ProfileAddress): void {
    this.editingAddressId.set(address.id);
    this.addressForm.reset({
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      landmark: address.landmark ?? '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country || 'India',
      isDefault: address.isDefault,
    });
    this.showAddressForm.set(true);
  }

  cancelAddressForm(): void {
    this.showAddressForm.set(false);
    this.editingAddressId.set(null);
  }

  saveAddress(): void {
    if (this.savingAddress()) return;

    this.addressForm.markAllAsTouched();
    if (this.addressForm.invalid) {
      this.error.set('Please correct the highlighted address fields.');
      this.info.set(null);
      return;
    }

    const raw = this.addressForm.getRawValue();
    const payload: AddressPayload = {
      addressLine1: raw.addressLine1.trim(),
      addressLine2: raw.addressLine2.trim(),
      landmark: raw.landmark.trim() || null,
      city: raw.city.trim(),
      state: raw.state,
      pincode: raw.pincode,
      country: 'India',
      isDefault: raw.isDefault,
      addressType: 'SHIPPING',
    };

    this.savingAddress.set(true);
    this.error.set(null);
    this.info.set(null);

    const editingId = this.editingAddressId();
    const request$ = editingId
      ? this.profileApi.updateAddress(editingId, payload)
      : this.profileApi.createAddress(payload);

    request$.subscribe({
      next: (data) => {
        this.savingAddress.set(false);
        this.addresses.set(data.items.filter((item) => item.addressType === 'SHIPPING'));
        this.showAddressForm.set(false);
        this.editingAddressId.set(null);
        this.info.set(editingId ? 'Address updated.' : 'Address added.');
      },
      error: () => {
        this.savingAddress.set(false);
        this.error.set(this.profileApi.error() ?? 'Unable to save address.');
      },
    });
  }

  setDefault(address: ProfileAddress): void {
    if (address.isDefault || this.savingAddress()) return;
    this.savingAddress.set(true);
    this.error.set(null);

    this.profileApi.setDefaultAddress(address.id).subscribe({
      next: (data) => {
        this.savingAddress.set(false);
        this.addresses.set(data.items.filter((item) => item.addressType === 'SHIPPING'));
        this.info.set('Default address updated.');
      },
      error: () => {
        this.savingAddress.set(false);
        this.error.set(this.profileApi.error() ?? 'Unable to set default address.');
      },
    });
  }

  removeAddress(address: ProfileAddress): void {
    if (this.savingAddress()) return;
    if (this.addresses().length <= 1) {
      this.error.set('Keep at least one shipping address.');
      return;
    }

    this.savingAddress.set(true);
    this.error.set(null);

    this.profileApi.deleteAddress(address.id).subscribe({
      next: (data) => {
        this.savingAddress.set(false);
        this.addresses.set(data.items.filter((item) => item.addressType === 'SHIPPING'));
        this.info.set('Address removed.');
      },
      error: () => {
        this.savingAddress.set(false);
        this.error.set(this.profileApi.error() ?? 'Unable to remove address.');
      },
    });
  }

  formatAddress(address: ProfileAddress): string {
    const landmark = address.landmark ? `, ${address.landmark}` : '';
    return `${address.addressLine1}, ${address.addressLine2}${landmark}, ${address.city}, ${address.state} ${address.pincode}`;
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.profileApi.get().subscribe({
      next: (data) => {
        this.loading.set(false);
        this.personalForm.patchValue({
          fullName: data.profile.fullName ?? '',
          mobile: data.profile.mobile ?? '',
          email: data.profile.email ?? '',
          dob: data.profile.dob ?? '',
          gender: data.profile.gender ?? '',
        });
        if (data.profile.fullName) {
          this.auth.updateUser({
            fullName: data.profile.fullName,
            email: data.profile.email ?? undefined,
          });
        }
        this.addresses.set(
          (data.addresses ?? []).filter((item) => item.addressType === 'SHIPPING'),
        );
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.profileApi.error() ?? 'Unable to load profile.');
      },
    });
  }
}
