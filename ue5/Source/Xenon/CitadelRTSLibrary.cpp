// Citadel of Legends — Core C++ RTS Tactical Gameplay Library
#include "CitadelRTSLibrary.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"

FCitadelFormationSlot UCitadelRTSLibrary::ComputeFormationSlot(
	const FVector& Destination,
	const FVector& MarchDirection,
	int32 UnitIndex,
	int32 TotalUnits,
	bool bIsRanged,
	float UnitSpacing)
{
	FCitadelFormationSlot Slot;
	const int32 SafeTotal = FMath::Max(1, TotalUnits);
	const int32 SafeIndex = FMath::Clamp(UnitIndex, 0, SafeTotal - 1);

	FVector Forward = FVector(MarchDirection.X, MarchDirection.Y, 0.0f);
	if (!Forward.Normalize())
	{
		Forward = FVector(1.0f, 0.0f, 0.0f);
	}
	const FVector Right(-Forward.Y, Forward.X, 0.0f);

	// 4 to 6 soldiers wide depending on army size
	const int32 Columns = FMath::Clamp(FMath::CeilToInt(FMath::Sqrt(static_cast<float>(SafeTotal)) * 1.4f), 3, 6);
	const int32 Row = SafeIndex / Columns;
	const int32 Col = SafeIndex % Columns;
	const int32 RowCount = FMath::Min(Columns, SafeTotal - Row * Columns);

	const float LateralOffset = (static_cast<float>(Col) - 0.5f * static_cast<float>(RowCount - 1)) * UnitSpacing;
	// Ranged troops hold behind melee vanguard ranks
	const float DepthRank = static_cast<float>(Row) + (bIsRanged ? 1.5f : -0.5f);
	const float ForwardOffset = -DepthRank * UnitSpacing;

	Slot.WorldLocation = Destination + Right * LateralOffset + Forward * ForwardOffset;
	Slot.WorldLocation.Z = Destination.Z;
	Slot.FacingYaw = Forward.Rotation().Yaw;
	return Slot;
}

TArray<AActor*> UCitadelRTSLibrary::SelectUnitsInScreenBox(
	const UObject* WorldContextObject,
	APlayerController* PlayerController,
	FVector2D ScreenStart,
	FVector2D ScreenEnd,
	FName RequiredUnitTag,
	FName RequiredTeamTag)
{
	TArray<AActor*> Selected;
	if (!WorldContextObject || !PlayerController)
	{
		return Selected;
	}

	UWorld* World = GEngine ? GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::ReturnNull) : nullptr;
	if (!World)
	{
		return Selected;
	}

	const float MinX = FMath::Min(ScreenStart.X, ScreenEnd.X);
	const float MaxX = FMath::Max(ScreenStart.X, ScreenEnd.X);
	const float MinY = FMath::Min(ScreenStart.Y, ScreenEnd.Y);
	const float MaxY = FMath::Max(ScreenStart.Y, ScreenEnd.Y);

	TArray<AActor*> Candidates;
	UGameplayStatics::GetAllActorsWithTag(World, RequiredUnitTag, Candidates);

	for (AActor* Actor : Candidates)
	{
		if (!IsValid(Actor))
		{
			continue;
		}
		if (!RequiredTeamTag.IsNone() && !Actor->ActorHasTag(RequiredTeamTag))
		{
			continue;
		}

		FVector2D ScreenPos;
		if (PlayerController->ProjectWorldLocationToScreen(Actor->GetActorLocation() + FVector(0.0f, 0.0f, 60.0f), ScreenPos, true))
		{
			if (ScreenPos.X >= MinX && ScreenPos.X <= MaxX && ScreenPos.Y >= MinY && ScreenPos.Y <= MaxY)
			{
				Selected.Add(Actor);
			}
		}
	}

	return Selected;
}

FCitadelCombatResult UCitadelRTSLibrary::ComputeStrongholdDamage(
	float BaseDamage,
	float AttackerZ,
	float DefenderZ,
	bool bIsRanged,
	bool bIsSiege,
	bool bTargetIsBuilding)
{
	FCitadelCombatResult Result;
	float Multiplier = 1.0f;

	// Stronghold rule: elevated archers / tower defenders gain +35% damage
	if (bIsRanged && (AttackerZ - DefenderZ) >= 75.0f)
	{
		Multiplier *= 1.35f;
		Result.bHighGroundBonus = true;
	}

	// Stronghold rule: siege engines crush masonry walls & keeps (3.0x vs buildings)
	if (bIsSiege && bTargetIsBuilding)
	{
		Multiplier *= 3.0f;
		Result.bSiegeBonus = true;
	}

	Result.FinalDamage = FMath::Max(1.0f, BaseDamage * Multiplier);
	return Result;
}

FVector UCitadelRTSLibrary::GetStrategicCrossingPoint(int32 LaneIndex, float MapScale)
{
	const float S = FMath::Max(0.5f, MapScale);
	const int32 Lane = ((LaneIndex % 3) + 3) % 3;
	switch (Lane)
	{
	case 0: // Northern Whispering Ford
		return FVector(0.0f, 4600.0f * S, 0.0f);
	case 2: // Southern Quarry Timber Bridge
		return FVector(0.0f, -4600.0f * S, 0.0f);
	case 1: // Central Grand Stone Keep Bridge
	default:
		return FVector(0.0f, 0.0f, 0.0f);
	}
}

float UCitadelRTSLibrary::EvaluateConstructionZOffset(float NormalizedProgress, float BuriedDepth)
{
	const float P = FMath::Clamp(NormalizedProgress, 0.0f, 1.0f);
	const float Inv = 1.0f - P;
	// Smooth cubic ease-out: rises rapidly from foundation and locks cleanly at Z=0
	return -BuriedDepth * (Inv * Inv * Inv);
}

FVector UCitadelRTSLibrary::ClampToValleyBounds(const FVector& Location, float HalfExtentX, float HalfExtentY)
{
	return FVector(
		FMath::Clamp(Location.X, -HalfExtentX, HalfExtentX),
		FMath::Clamp(Location.Y, -HalfExtentY, HalfExtentY),
		Location.Z);
}
