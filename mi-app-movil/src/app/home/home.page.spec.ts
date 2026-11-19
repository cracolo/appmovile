import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { HomePage } from './home.page';
import { PhotoService } from '../services/photo.service';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        {
          provide: PhotoService,
          useValue: {
            photos: [],
            loadSaved: vi.fn().mockResolvedValue(undefined),
            addNewToGallery: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
