import { SkeletonPost } from './ui';

export default function PageLoader() {
  return (
    <div className="p-4 space-y-3 max-w-2xl mx-auto">
      <SkeletonPost />
      <SkeletonPost />
    </div>
  );
}
