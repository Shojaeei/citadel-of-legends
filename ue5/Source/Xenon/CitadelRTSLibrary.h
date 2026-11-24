// Citadel of Legends — Core C++ RTS Tactical Gameplay Library
#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "CitadelRTSLibrary.generated.h"

class APlayerController;

USTRUCT(BlueprintType)
struct FCitadelFormationSlot
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadWrite, Category = "Citadel|RTS")
	FVector WorldLocation = FVector::ZeroVector;

	UPROPERTY(BlueprintReadWrite, Category = "Citadel|RTS")
	float FacingYaw = 0.0f;
};

USTRUCT(BlueprintType)
struct FCitadelCombatResult
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadWrite, Category = "Citadel|Combat")
	float FinalDamage = 0.0f;

	UPROPERTY(BlueprintReadWrite, Category = "Citadel|Combat")
	bool bHighGroundBonus = false;

	UPROPERTY(BlueprintReadWrite, Category = "Citadel|Combat")
	bool bSiegeBonus = false;
};

/**
 * High-performance C++ tactical helpers for Stronghold-style RTS gameplay:
 * - Disciplined rank-and-file military formations (melee vanguard + ranged backline)
 * - Marquee screen-space drag-box unit selection (desktop & mobile)
 * - High-ground archer elevation bonus & siege anti-fortification damage
 * - Multi-lane river crossing raid routing (North Ford, Central Bridge, South Bridge)
 * - Smooth cubic construction rise-up interpolation
 */
UCLASS()
class XENON_API UCitadelRTSLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** Computes a disciplined military rank-and-file slot around Destination facing MarchDir. */
	UFUNCTION(BlueprintPure, Category = "Citadel|Formation")
	static FCitadelFormationSlot ComputeFormationSlot(
		const FVector& Destination,
		const FVector& MarchDirection,
		int32 UnitIndex,
		int32 TotalUnits,
		bool bIsRanged,
		float UnitSpacing = 145.0f);

	/** Selects all actors matching TeamTag whose projected screen positions fall inside [BoxMin, BoxMax]. */
	UFUNCTION(BlueprintCallable, Category = "Citadel|Selection", meta = (WorldContext = "WorldContextObject"))
	static TArray<AActor*> SelectUnitsInScreenBox(
		const UObject* WorldContextObject,
		APlayerController* PlayerController,
		FVector2D ScreenStart,
		FVector2D ScreenEnd,
		FName RequiredUnitTag = FName(TEXT("Unit")),
		FName RequiredTeamTag = FName(TEXT("Team_Player")));

	/** Stronghold-style combat damage: +35% ranged high-ground bonus, 3.0x siege damage vs buildings. */
	UFUNCTION(BlueprintPure, Category = "Citadel|Combat")
	static FCitadelCombatResult ComputeStrongholdDamage(
		float BaseDamage,
		float AttackerZ,
		float DefenderZ,
		bool bIsRanged,
		bool bIsSiege,
		bool bTargetIsBuilding);

	/** Returns the strategic crossing waypoint for Lane 0 (North Ford), 1 (Central Stone Bridge), or 2 (South Timber Bridge). */
	UFUNCTION(BlueprintPure, Category = "Citadel|AI")
	static FVector GetStrategicCrossingPoint(int32 LaneIndex, float MapScale = 1.0f);

	/** Smooth cubic ease-out vertical construction offset (negative Z while rising, 0 when complete). */
	UFUNCTION(BlueprintPure, Category = "Citadel|Building")
	static float EvaluateConstructionZOffset(float NormalizedProgress, float BuriedDepth = 260.0f);

	/** Clamps a world coordinate cleanly inside the valley playable bounds. */
	UFUNCTION(BlueprintPure, Category = "Citadel|Map")
	static FVector ClampToValleyBounds(const FVector& Location, float HalfExtentX = 17500.0f, float HalfExtentY = 13500.0f);
};
