import { useState, useCallback, useMemo, ReactNode } from "react";
import { useRouter } from "../router";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import {
  BooleanChoice,
  CommitmentCard,
  ErrorMsg,
  FieldLabel,
  HoursAloneSlider,
  Input,
  NavButtons,
  PuppyCompanion,
  RadioGroup,
  Reassurance,
  RibbonProgress,
  STEP_NAMES,
  Stagger,
  StepHeader,
  StepPanel,
  Textarea,
  useConfetti,
} from "../components/apply/ui";
import { useAsync } from "../../hooks/useAsync";
import { listPuppies } from "../../services/puppies";
import { submitApplication } from "../../services/applications";
import { scoreApplication } from "../../lib/scoring";
import { useSettings } from "../../lib/settings";
import { settingBool } from "../../services/misc";

interface Pet {
  species: string;
  age: string;
  sex: string;
  vaccinated: boolean;
  neutered: boolean;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  notificationPreference: "email" | "whatsapp" | "both";
  applicantWhatsapp: string;
  ownership: "own" | "rent" | "";
  landlordAllows: "yes" | "no" | "unsure" | "";
  homeType: "house" | "apartment" | "compound" | "";
  fencedSpace: "yes" | "partial" | "no" | "";
  adultCount: string;
  childrenAges: string;
  allergies: string;
  primaryCarer: string;
  hasPets: boolean | null;
  pets: Pet[];
  hoursAlone: number;
  dogSleeps: string;
  travelCare: string;
  ownedBefore: boolean | null;
  previousDogHistory: string;
  willReturn: boolean;
  willSpayNeuter: boolean;
  understandsDecline: boolean;
  additionalInfo: string;
}

const EMPTY_PET: Pet = { species: "", age: "", sex: "", vaccinated: false, neutered: false };

const INITIAL: FormData = {
  firstName: "", lastName: "", email: "", phone: "", city: "", country: "",
  notificationPreference: "email", applicantWhatsapp: "",
  ownership: "", landlordAllows: "", homeType: "", fencedSpace: "",
  adultCount: "", childrenAges: "", allergies: "", primaryCarer: "",
  hasPets: null, pets: [],
  hoursAlone: 3, dogSleeps: "", travelCare: "",
  ownedBefore: null, previousDogHistory: "",
  willReturn: false, willSpayNeuter: false, understandsDecline: false,
  additionalInfo: "",
};

export default function ApplyPage() {
  const { navigate, getParam } = useRouter();
  const { settings } = useSettings();
  const puppySlug = getParam("puppy");

  const { data: puppies, error: puppiesError } = useAsync(() => listPuppies(), []);
  if (puppiesError) console.warn("[apply] could not load puppies:", puppiesError.message);
  const targetPuppy = puppySlug
    ? (puppies ?? []).find((p) => p.slug === puppySlug) ?? null
    : null;

  const applicationsOpen = settingBool(settings, "applications_open", true);

  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const celebrate = useConfetti();

  // Live preview of the same rubric the database applies on insert.
  const preview = useMemo(
    () =>
      scoreApplication({
        ownership: data.ownership,
        landlordAllows: data.landlordAllows,
        homeType: data.homeType,
        fencedSpace: data.fencedSpace,
        hoursAlone: data.hoursAlone,
        adultCount: Number(data.adultCount) || 0,
        childrenAges: data.childrenAges,
        ownedBefore: data.ownedBefore,
        previousDogHistory: data.previousDogHistory,
        willReturn: data.willReturn,
        willSpayNeuter: data.willSpayNeuter,
        understandsDecline: data.understandsDecline,
        travelCare: data.travelCare,
        dogSleeps: data.dogSleeps,
      }),
    [data]
  );

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => { const next = { ...e }; delete next[key]; return next; });
  }, []);

  const addPet = () => set("pets", [...data.pets, { ...EMPTY_PET }]);
  const removePet = (i: number) => set("pets", data.pets.filter((_, idx) => idx !== i));
  const updatePet = (i: number, field: keyof Pet, value: string | boolean) => {
    const updated = data.pets.map((p, idx) => idx === i ? { ...p, [field]: value } : p);
    set("pets", updated);
  };

  const validate1 = () => {
    const errs: typeof errors = {};
    if (!data.firstName.trim()) errs.firstName = "First name is required";
    if (!data.lastName.trim()) errs.lastName = "Last name is required";
    if (!data.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = "A valid email address is required";
    if (!data.phone.trim()) errs.phone = "WhatsApp number is required";
    if (!data.city.trim()) errs.city = "City is required";
    if (!data.country.trim()) errs.country = "Country is required";
    return errs;
  };

  const validate2 = () => {
    const errs: typeof errors = {};
    if (!data.ownership) errs.ownership = "Please select one";
    if (data.ownership === "rent" && !data.landlordAllows) errs.landlordAllows = "Please select one";
    if (!data.homeType) errs.homeType = "Please select one";
    if (!data.fencedSpace) errs.fencedSpace = "Please select one";
    return errs;
  };

  const validate3 = () => {
    const errs: typeof errors = {};
    if (!data.adultCount || Number(data.adultCount) < 1) errs.adultCount = "Please enter number of adults";
    if (!data.primaryCarer.trim()) errs.primaryCarer = "Primary carer name is required";
    return errs;
  };

  const validate4 = () => {
    const errs: typeof errors = {};
    if (data.hasPets === null) errs.hasPets = "Please answer this question";
    if (data.hasPets && data.pets.length > 0 && data.pets.some((p) => !p.species.trim())) errs.pets = "Please specify the species for each pet";
    return errs;
  };

  const validate5 = () => {
    const errs: typeof errors = {};
    if (!data.dogSleeps.trim()) errs.dogSleeps = "Please describe where the dog will sleep";
    if (!data.travelCare.trim()) errs.travelCare = "Please describe care arrangements during travel";
    return errs;
  };

  const validate6 = () => {
    const errs: typeof errors = {};
    if (data.ownedBefore === null) errs.ownedBefore = "Please answer this question";
    if (data.ownedBefore === true && !data.previousDogHistory.trim()) errs.previousDogHistory = "This field is required";
    return errs;
  };

  const validate7 = () => {
    const errs: typeof errors = {};
    if (!data.willReturn) errs.willReturn = "This commitment is required to proceed";
    if (!data.willSpayNeuter) errs.willSpayNeuter = "This commitment is required to proceed";
    if (!data.understandsDecline) errs.understandsDecline = "Please acknowledge this to proceed";
    return errs;
  };

  const validators = [validate1, validate2, validate3, validate4, validate5, validate6, validate7, () => ({})];

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitApplication({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        city: data.city,
        country: data.country,
        notificationPreference: data.notificationPreference,
        applicantWhatsapp: data.applicantWhatsapp || data.phone,
        ownership: data.ownership,
        landlordAllows: data.landlordAllows,
        homeType: data.homeType,
        fencedSpace: data.fencedSpace,
        adultCount: data.adultCount,
        childrenAges: data.childrenAges,
        allergies: data.allergies,
        primaryCarer: data.primaryCarer,
        hasPets: data.hasPets,
        pets: data.pets,
        hoursAlone: data.hoursAlone,
        dogSleeps: data.dogSleeps,
        travelCare: data.travelCare,
        ownedBefore: data.ownedBefore,
        previousDogHistory: data.previousDogHistory,
        willReturn: data.willReturn,
        willSpayNeuter: data.willSpayNeuter,
        understandsDecline: data.understandsDecline,
        additionalInfo: data.additionalInfo,
        puppyId: targetPuppy?.id ?? null,
        puppySlug: targetPuppy?.slug ?? null,
        puppyName: targetPuppy?.name ?? null,
      });

      celebrate();
      // Let the confetti register before the route changes.
      await new Promise((resolve) => setTimeout(resolve, 550));

      // Carry the reference through so the confirmation page can show it.
      navigate(
        "/apply/received?ref=" + encodeURIComponent(result.reference)
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "We could not submit your application. Please try again."
      );
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    const errs = validators[step - 1]();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (step === 8) {
      void handleSubmit();
      return;
    }
    setStep((s) => s + 1);
    setErrors({});
  };

  const handleBack = () => {
    setStep((s) => s - 1);
    setErrors({});
  };

  const editSection = (targetStep: number) => {
    setStep(targetStep);
    setErrors({});
  };

  const formContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This information helps us contact you and understand where you live.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>First name</FieldLabel>
                <Input value={data.firstName} onChange={(v) => set("firstName", v)} placeholder="Elena" />
                {errors.firstName && <ErrorMsg msg={errors.firstName} />}
              </div>
              <div>
                <FieldLabel required>Last name</FieldLabel>
                <Input value={data.lastName} onChange={(v) => set("lastName", v)} placeholder="Marchetti" />
                {errors.lastName && <ErrorMsg msg={errors.lastName} />}
              </div>
            </div>
            <div>
              <FieldLabel required>Email address</FieldLabel>
              <Input type="email" value={data.email} onChange={(v) => set("email", v)} placeholder="elena@example.com" />
              {errors.email && <ErrorMsg msg={errors.email} />}
            </div>
            <div>
              <FieldLabel required>WhatsApp number (with country code)</FieldLabel>
              <Input type="tel" value={data.phone} onChange={(v) => set("phone", v)} placeholder="+65 9123 4567" />
              {errors.phone && <ErrorMsg msg={errors.phone} />}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>City</FieldLabel>
                <Input value={data.city} onChange={(v) => set("city", v)} placeholder="Singapore" />
                {errors.city && <ErrorMsg msg={errors.city} />}
              </div>
              <div>
                <FieldLabel required>Country</FieldLabel>
                <Input value={data.country} onChange={(v) => set("country", v)} placeholder="Singapore" />
                {errors.country && <ErrorMsg msg={errors.country} />}
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <FieldLabel required>Approval Notification Channel</FieldLabel>
              <p className="text-xs text-muted-foreground mb-3">
                Choose how you would like to be notified and receive your official Proof Certificate when your application is approved.
              </p>
              <RadioGroup
                name="notificationPreference"
                value={data.notificationPreference}
                onChange={(v) => set("notificationPreference", v as "email" | "whatsapp" | "both")}
                options={[
                  { value: "email", label: "Email (Default)", hint: "Automated confirmation sent to your email address." },
                  { value: "whatsapp", label: "WhatsApp", hint: "Automated confirmation sent to your WhatsApp number." },
                  { value: "both", label: "Both Email & WhatsApp", hint: "Receive instant notifications on both channels." },
                ]}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="flex flex-col gap-7">
            <p className="text-sm text-muted-foreground leading-relaxed">
              We want to understand the physical environment the dog will live in.
            </p>
            <div>
              <FieldLabel required>Do you own or rent your home?</FieldLabel>
              <RadioGroup
                name="ownership"
                value={data.ownership}
                onChange={(v) => set("ownership", v)}
                columns={2}
                options={[
                  { value: "own", label: "I own", hint: "No landlord permission needed." },
                  { value: "rent", label: "I rent", hint: "We will ask about your tenancy next." },
                ]}
              />
              {errors.ownership && <ErrorMsg msg={errors.ownership} />}
            </div>

            {data.ownership === "rent" && (
              <div>
                <FieldLabel required>Does your landlord permit dogs?</FieldLabel>
                <RadioGroup
                  name="landlordAllows"
                  value={data.landlordAllows}
                  onChange={(v) => set("landlordAllows", v)}
                  options={[
                    { value: "yes", label: "Yes, in writing", hint: "Best case - we may ask to see it." },
                    { value: "no", label: "No", hint: "We cannot place a puppy where dogs are not permitted." },
                    { value: "unsure", label: "Unsure, I need to ask", hint: "Worth confirming before we go further." },
                  ]}
                />
                {errors.landlordAllows && <ErrorMsg msg={errors.landlordAllows} />}
              </div>
            )}

            <div>
              <FieldLabel required>Home type</FieldLabel>
              <RadioGroup
                name="homeType"
                value={data.homeType}
                onChange={(v) => set("homeType", v)}
                options={[
                  { value: "house", label: "House", hint: "With or without a garden." },
                  { value: "apartment", label: "Apartment", hint: "Perfectly workable for this breed." },
                  { value: "compound", label: "Compound or villa", hint: "Shared or gated grounds count here." },
                ]}
              />
              {errors.homeType && <ErrorMsg msg={errors.homeType} />}
            </div>

            <div>
              <FieldLabel required>Fenced outdoor space</FieldLabel>
              <RadioGroup
                name="fencedSpace"
                value={data.fencedSpace}
                onChange={(v) => set("fencedSpace", v)}
                options={[
                  { value: "yes", label: "Yes, fully fenced", hint: "Somewhere they cannot get out of." },
                  { value: "partial", label: "Partially fenced", hint: "Some boundaries, some gaps." },
                  { value: "no", label: "No fenced space", hint: "Not a barrier - many of ours live in apartments." },
                ]}
              />
              {errors.fencedSpace && <ErrorMsg msg={errors.fencedSpace} />}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Yorkshire Terriers attach hard to their people. They do best when they know who is responsible for them.
            </p>
            <div>
              <FieldLabel required>Number of adults in the household</FieldLabel>
              <Input
                type="number"
                value={data.adultCount}
                onChange={(v) => set("adultCount", v)}
                placeholder="2"
              />
              {errors.adultCount && <ErrorMsg msg={errors.adultCount} />}
            </div>
            <div>
              <FieldLabel>Children's ages (if any)</FieldLabel>
              <Input value={data.childrenAges} onChange={(v) => set("childrenAges", v)} placeholder="e.g. 4, 9 — or leave blank" />
              <p className="text-xs text-muted-foreground mt-1">Leave blank if no children</p>
            </div>
            <div>
              <FieldLabel>Known allergies in the household</FieldLabel>
              <Input value={data.allergies} onChange={(v) => set("allergies", v)} placeholder="e.g. dog hair allergy (tested), none known" />
            </div>
            <div>
              <FieldLabel required>Who will be the primary carer?</FieldLabel>
              <Input value={data.primaryCarer} onChange={(v) => set("primaryCarer", v)} placeholder="Full name of primary carer" />
              {errors.primaryCarer && <ErrorMsg msg={errors.primaryCarer} />}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you have other pets, we need to understand whether the household is a safe environment for a small dog.
            </p>
            <div>
              <FieldLabel required>Do you have other pets?</FieldLabel>
              <RadioGroup
                name="hasPets"
                value={data.hasPets === null ? "" : data.hasPets ? "yes" : "no"}
                onChange={(v) => {
                  set("hasPets", v === "yes");
                  if (v === "no") set("pets", []);
                }}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
              />
              {errors.hasPets && <ErrorMsg msg={errors.hasPets} />}
            </div>

            {data.hasPets && (
              <div className="flex flex-col gap-4">
                {data.pets.map((pet, i) => (
                  <div key={i} className="border border-border rounded-sm p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Pet {i + 1}
                      </span>
                      <button
                        onClick={() => removePet(i)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Remove pet"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Species</FieldLabel>
                        <Input value={pet.species} onChange={(v) => updatePet(i, "species", v)} placeholder="Dog, cat…" />
                      </div>
                      <div>
                        <FieldLabel>Age</FieldLabel>
                        <Input value={pet.age} onChange={(v) => updatePet(i, "age", v)} placeholder="3 years" />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Sex</FieldLabel>
                      <Input value={pet.sex} onChange={(v) => updatePet(i, "sex", v)} placeholder="Male, female…" />
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pet.vaccinated}
                          onChange={(e) => updatePet(i, "vaccinated", e.target.checked)}
                          className="rounded-sm border-border text-accent focus:ring-ring"
                        />
                        Vaccinated
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pet.neutered}
                          onChange={(e) => updatePet(i, "neutered", e.target.checked)}
                          className="rounded-sm border-border text-accent focus:ring-ring"
                        />
                        Spayed / neutered
                      </label>
                    </div>
                  </div>
                ))}
                {errors.pets && <ErrorMsg msg={errors.pets} />}
                <button
                  onClick={addPet}
                  className="flex items-center gap-2 text-sm font-medium text-accent hover:text-foreground transition-colors py-2"
                >
                  <Plus size={14} />
                  Add a pet
                </button>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Yorkshire Terriers are prone to separation anxiety and do not cope well with long periods alone. Please answer honestly.
            </p>
            <div>
              <FieldLabel>Hours alone on a typical weekday</FieldLabel>
              <HoursAloneSlider
                value={data.hoursAlone}
                onChange={(v) => set("hoursAlone", v)}
              />
              {data.hoursAlone > 7 && (
                <p className="text-xs text-primary mt-3 flex items-start gap-1.5 leading-relaxed">
                  <AlertCircle size={12} className="shrink-0 mt-px" />
                  More than seven hours alone is a significant concern for this breed. Tell us
                  below how you plan to break the day up — a walker, a neighbour, working from
                  home some days. We read this carefully.
                </p>
              )}
            </div>
            <div>
              <FieldLabel required>Where will the dog sleep?</FieldLabel>
              <Textarea
                value={data.dogSleeps}
                onChange={(v) => set("dogSleeps", v)}
                placeholder="e.g. In a crate in our bedroom, on the bed with us…"
                rows={2}
              />
              {errors.dogSleeps && <ErrorMsg msg={errors.dogSleeps} />}
            </div>
            <div>
              <FieldLabel required>Who cares for the dog when you travel?</FieldLabel>
              <Textarea
                value={data.travelCare}
                onChange={(v) => set("travelCare", v)}
                placeholder="e.g. Family member who lives nearby, professional dog sitter we know well…"
                rows={2}
              />
              {errors.travelCare && <ErrorMsg msg={errors.travelCare} />}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              We are not looking for experience. We are looking for honesty and the ability to reflect.
            </p>
            <div>
              <FieldLabel required>Have you owned a dog before?</FieldLabel>
              <RadioGroup
                name="ownedBefore"
                value={data.ownedBefore === null ? "" : data.ownedBefore ? "yes" : "no"}
                onChange={(v) => set("ownedBefore", v === "yes")}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No, this would be my first dog" },
                ]}
              />
              {errors.ownedBefore && <ErrorMsg msg={errors.ownedBefore} />}
            </div>

            {data.ownedBefore && (
              <div className="bg-[#FFF8F8] border border-primary/20 rounded-sm p-4">
                <div className="flex items-start gap-2 mb-3">
                  <AlertCircle size={14} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                    Important — please answer fully
                  </p>
                </div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  What happened to your previous dog?{" "}
                  <span className="text-primary">*</span>
                </label>
                <Textarea
                  value={data.previousDogHistory}
                  onChange={(v) => set("previousDogHistory", v)}
                  placeholder="Please describe what happened to each dog you have owned — including age at death and cause, or current situation if still with you. There is no wrong answer; we are looking for honesty."
                  rows={5}
                />
                {errors.previousDogHistory && <ErrorMsg msg={errors.previousDogHistory} />}
              </div>
            )}
          </div>
        );

      case 7:
        return (
          <div className="flex flex-col gap-6">
            <div className="bg-secondary rounded-sm p-5">
              <p className="text-xs tracking-[0.15em] uppercase font-medium text-muted-foreground mb-3">
                Cost awareness
              </p>
              <ul className="text-sm text-foreground leading-relaxed space-y-2">
                <li>Professional grooming is required roughly every six weeks. At a quality salon, a full Yorkshire Terrier groom is not inexpensive.</li>
                <li>Annual veterinary care — vaccinations, dental checks, routine health monitoring — should be budgeted as a fixed cost.</li>
                <li>Unexpected veterinary expenses should be covered by pet insurance or a dedicated savings reserve.</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We require three commitments from every adopter. Please read each carefully before checking.
            </p>
            <div className="flex flex-col gap-3">
              <CommitmentCard
                checked={data.willReturn}
                onChange={(v) => set("willReturn", v)}
                title="If I cannot keep this dog, I will return them to you."
                body="At any point in their life, for any reason. No third-party rehoming, no online listings. This is the promise we care most about."
              />
              {errors.willReturn && <ErrorMsg msg={errors.willReturn} />}

              <CommitmentCard
                checked={data.willSpayNeuter}
                onChange={(v) => set("willSpayNeuter", v)}
                title="I will spay or neuter at the age our vet recommends."
                body="Unless a medical exemption applies. We do not place puppies for breeding."
              />
              {errors.willSpayNeuter && <ErrorMsg msg={errors.willSpayNeuter} />}

              <CommitmentCard
                checked={data.understandsDecline}
                onChange={(v) => set("understandsDecline", v)}
                title="I understand this application may be declined."
                body="And that we may not give a specific reason. It is never a judgement of you — only of what a particular dog needs right now."
              />
              {errors.understandsDecline && <ErrorMsg msg={errors.understandsDecline} />}
            </div>
          </div>
        );

      case 8:
        return (
          <div className="flex flex-col gap-8">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Please review your answers. Use the Edit links to go back and change anything before you submit.
            </p>

            <ScorePreview result={preview} />

            <ReviewSection title="About you" onEdit={() => editSection(1)}>
              <ReviewRow label="Name" value={`${data.firstName} ${data.lastName}`} />
              <ReviewRow label="Email" value={data.email} />
              <ReviewRow label="WhatsApp" value={data.phone} />
              <ReviewRow label="Location" value={`${data.city}, ${data.country}`} />
            </ReviewSection>

            <ReviewSection title="Your home" onEdit={() => editSection(2)}>
              <ReviewRow label="Ownership" value={data.ownership} />
              {data.ownership === "rent" && <ReviewRow label="Landlord allows dogs" value={data.landlordAllows} />}
              <ReviewRow label="Home type" value={data.homeType} />
              <ReviewRow label="Fenced space" value={data.fencedSpace} />
            </ReviewSection>

            <ReviewSection title="Household" onEdit={() => editSection(3)}>
              <ReviewRow label="Adults" value={data.adultCount} />
              <ReviewRow label="Children's ages" value={data.childrenAges || "None"} />
              <ReviewRow label="Allergies" value={data.allergies || "None known"} />
              <ReviewRow label="Primary carer" value={data.primaryCarer} />
            </ReviewSection>

            <ReviewSection title="Other pets" onEdit={() => editSection(4)}>
              {data.hasPets && data.pets.length > 0 ? (
                data.pets.map((p, i) => (
                  <ReviewRow key={i} label={`Pet ${i + 1}`} value={`${p.species}, ${p.age}, ${p.sex}`} />
                ))
              ) : (
                <ReviewRow label="Pets" value="None" />
              )}
            </ReviewSection>

            <ReviewSection title="Daily life" onEdit={() => editSection(5)}>
              <ReviewRow label="Hours alone daily" value={`${data.hoursAlone}h`} />
              <ReviewRow label="Dog sleeps" value={data.dogSleeps} />
              <ReviewRow label="During travel" value={data.travelCare} />
            </ReviewSection>

            <ReviewSection title="Experience" onEdit={() => editSection(6)}>
              <ReviewRow label="Previously owned a dog" value={data.ownedBefore ? "Yes" : "No"} />
              {data.ownedBefore && <ReviewRow label="Previous dog history" value={data.previousDogHistory} />}
            </ReviewSection>

            <ReviewSection title="Commitments" onEdit={() => editSection(7)}>
              <ReviewRow label="Will return if needed" value={data.willReturn ? "Confirmed" : "—"} />
              <ReviewRow label="Will spay/neuter" value={data.willSpayNeuter ? "Confirmed" : "—"} />
              <ReviewRow label="Understands decline" value={data.understandsDecline ? "Confirmed" : "—"} />
            </ReviewSection>

            {targetPuppy && (
              <div className="bg-secondary rounded-sm p-4 text-sm">
                <span className="text-muted-foreground">Applying for: </span>
                <span className="font-medium text-foreground">{targetPuppy.name}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Anything else we should know? (optional)
              </label>
              <Textarea
                value={data.additionalInfo}
                onChange={(v) => set("additionalInfo", v)}
                placeholder="Any additional context about your household, lifestyle, or reasons for choosing a Yorkshire Terrier…"
                rows={4}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!applicationsOpen) {
    return <ApplicationsClosed onHome={() => navigate("/")} />;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 pt-12 pb-24">
        <div className="mb-8">
          <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-2">
            Adoption application
          </p>
          <h1
            className="text-3xl sm:text-4xl font-light text-foreground leading-tight"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            {targetPuppy ? `Applying for ${targetPuppy.name}` : "Adoption application"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3 max-w-md">
            Eight short steps, about ten minutes. There are no wrong answers — only honest
            ones, and honest is what helps us match well.
          </p>
        </div>

        {targetPuppy && (
          <PuppyCompanion
            name={targetPuppy.name}
            photo={targetPuppy.photos[0]}
            ageWeeks={targetPuppy.ageWeeks}
            sex={targetPuppy.sex}
          />
        )}

        <RibbonProgress step={step} />

        <StepPanel step={step}>
          <StepHeader step={step} />
          {formContent()}
        </StepPanel>

        {submitError && (
          <div
            className="mt-6 border border-primary/30 bg-[#FAF0F0] rounded-sm px-4 py-3 flex items-start gap-2"
            role="alert"
          >
            <AlertCircle size={15} className="text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-[#8B2D2D] leading-relaxed">{submitError}</p>
          </div>
        )}

        <NavButtons
          step={step}
          onBack={handleBack}
          onContinue={handleContinue}
          continueLabel={
            step === 8 ? (submitting ? "Submitting…" : "Submit application") : "Continue"
          }
          isLast={step === 8}
          busy={submitting}
        />

        <Reassurance>
          {step === 8
            ? "Once you send this, we read it in full. You will hear from us either way — we do not leave people waiting."
            : "Your answers are private and go only to the breeder. Nothing is shared, sold, or published."}
        </Reassurance>
      </div>
    </main>
  );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="border-t border-border pt-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">{title}</h3>
        <button
          onClick={onEdit}
          className="text-xs font-medium text-accent hover:text-foreground transition-colors underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          Edit
        </button>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value || "—"}</span>
    </div>
  );
}

/**
 * Transparency panel on the review step.
 *
 * The rubric is not a secret: showing an applicant where they stand — and
 * why — is fairer than a silent score, and it nudges people to fill in the
 * free-text answers that the breeder actually reads.
 */
function ScorePreview({
  result,
}: {
  result: { score: number; breakdown: Array<{ label: string; points: number; max: number; reason: string }> };
}) {
  const [open, setOpen] = useState(false);
  const pct = (result.score / 10) * 100;

  return (
    <div className="border border-border rounded-sm p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-foreground">How your application reads</p>
        <span className="text-sm font-medium text-foreground tabular-nums shrink-0">
          {result.score} / 10
        </span>
      </div>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
        This is a guide, not a verdict. Every application is read in full by a person, and the
        written answers carry more weight than the number.
      </p>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-sm font-medium text-accent underline underline-offset-4 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        {open ? "Hide the breakdown" : "See the breakdown"}
      </button>

      {open && (
        <ul className="flex flex-col gap-3 mt-4">
          {result.breakdown.map((factor) => (
            <li key={factor.label}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-sm text-foreground">{factor.label}</span>
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {factor.points} / {factor.max}
                </span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden mb-1">
                <div
                  className="h-full bg-accent/70 rounded-full"
                  style={{ width: `${factor.max > 0 ? (factor.points / factor.max) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{factor.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Shown when the breeder has paused applications in the dashboard. */
function ApplicationsClosed({ onHome }: { onHome: () => void }) {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-6 pt-20 pb-24">
        <p className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground font-medium mb-4">
          Applications
        </p>
        <h1
          className="text-4xl font-light text-foreground mb-6 leading-tight"
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          We are not accepting applications right now.
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed mb-4">
          We take one or two litters a year, and we close applications while we work through the
          ones we already have. This is deliberate: it is how every family gets a proper answer.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-10">
          Use the message button in the corner if you would like to talk to us in the meantime.
        </p>
        <button
          onClick={onHome}
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          ← Return to home
        </button>
      </div>
    </main>
  );
}
